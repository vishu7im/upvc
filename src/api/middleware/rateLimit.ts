// =====================================================================
// api/middleware/rateLimit.ts — tiny in-memory fixed-window limiter
// (PLAN §6.3 / §8). Zero deps; state resets on restart (acceptable now —
// a Redis-backed limiter is a tenancy-phase concern). Applied to login and
// change-password, where admin-set temp passwords widen the guessable
// surface. Keyed per caller (IP, optionally + email) so one attacker can't
// lock out everyone.
// =====================================================================

import type { NextFunction, Request, RequestHandler, Response } from "express";
import { HttpError } from "../http.ts";

export interface RateLimitOptions {
  /** window length in milliseconds */
  windowMs: number;
  /** max requests allowed per key per window */
  max: number;
  /** derive the bucket key (default: client IP) */
  keyFn?: (req: Request) => string;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export function rateLimit(opts: RateLimitOptions): RequestHandler {
  const buckets = new Map<string, Bucket>();

  return (req: Request, _res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = opts.keyFn ? opts.keyFn(req) : (req.ip ?? "unknown");

    let bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count++;

    if (bucket.count > opts.max) {
      throw new HttpError(429, "Too many attempts — please try again later");
    }
    next();
  };
}

/** Lowercased email from the request body, for composite login keys. */
export function emailKey(req: Request): string {
  const email = typeof req.body?.email === "string" ? req.body.email.toLowerCase() : "";
  return `${req.ip ?? "unknown"}:${email}`;
}
