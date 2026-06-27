// =====================================================================
// services/storage.ts — object storage seam (S3-compatible: MinIO / S3 / DO Spaces).
//
// The ONLY place that talks to object storage. Engine code never imports this.
// Configured entirely from env so the same code runs against local MinIO in dev
// and a managed S3 bucket in prod (just change endpoint + keys).
//
//   MINIO_ENDPOINT=http://localhost:9000   (omit for real AWS S3)
//   MINIO_ACCESS_KEY / MINIO_SECRET_KEY
//   MINIO_BUCKET=upvc
//   MINIO_REGION=us-east-1
//   MINIO_FORCE_PATH_STYLE=true            (required for MinIO)
//
// Object keys are deterministic, so existence == "is it cached":
//   orders/{orderId}/{TYPE}.pdf            cached document PDFs
//   branding/logo                          the company logo
// =====================================================================

import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

const BUCKET = process.env.MINIO_BUCKET ?? "upvc";

let client: S3Client | null = null;

/** Lazily construct a single S3 client from env. */
function s3(): S3Client {
  if (client) return client;
  const endpoint = process.env.MINIO_ENDPOINT || undefined; // undefined → real AWS
  client = new S3Client({
    region: process.env.MINIO_REGION || "us-east-1",
    endpoint,
    // Path-style (bucket in the path) is required by MinIO; harmless for S3.
    forcePathStyle: (process.env.MINIO_FORCE_PATH_STYLE ?? "true") === "true",
    credentials:
      process.env.MINIO_ACCESS_KEY && process.env.MINIO_SECRET_KEY
        ? {
            accessKeyId: process.env.MINIO_ACCESS_KEY,
            secretAccessKey: process.env.MINIO_SECRET_KEY,
          }
        : undefined, // fall back to the AWS default credential chain
  });
  return client;
}

/** True when object storage is configured (an endpoint or AWS creds are present). */
export function storageConfigured(): boolean {
  return Boolean(process.env.MINIO_ENDPOINT || process.env.MINIO_ACCESS_KEY);
}

/** Create the bucket if missing. Idempotent; safe to call at every boot. */
export async function ensureBucket(): Promise<void> {
  const c = s3();
  try {
    await c.send(new HeadBucketCommand({ Bucket: BUCKET }));
    return; // already exists
  } catch {
    // fall through and try to create
  }
  try {
    await c.send(new CreateBucketCommand({ Bucket: BUCKET }));
    console.log(`[storage] created bucket "${BUCKET}"`);
  } catch (err: any) {
    // BucketAlreadyOwnedByYou / race — treat as success.
    const code = err?.name ?? err?.Code;
    if (code === "BucketAlreadyOwnedByYou" || code === "BucketAlreadyExists") return;
    throw err;
  }
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/** Fetch an object's bytes + content type. Throws if it does not exist. */
export async function getObject(
  key: string,
): Promise<{ body: Buffer; contentType: string }> {
  const res = await s3().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const bytes = await res.Body!.transformToByteArray();
  return {
    body: Buffer.from(bytes),
    contentType: res.ContentType ?? "application/octet-stream",
  };
}

/** True if the object exists (used as the PDF cache check). */
export async function objectExists(key: string): Promise<boolean> {
  try {
    await s3().send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}
