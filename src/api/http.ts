// =====================================================================
// api/http.ts — shared HTTP helpers: typed request, async wrapper,
// error type + central error handler, and a zod validation helper.
// =====================================================================

import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

/** Express Request augmented with the authenticated user (set by requireAuth). */
export type AuthedRequest = Request & { user?: AuthUser };

/** Throwable HTTP error with a status code. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Wrap an async handler so thrown/rejected errors reach the error handler. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

/** Validate `data` against a zod schema; throw HttpError(400) on failure. */
export function validate<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const msg = result.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new HttpError(400, msg);
  }
  return result.data;
}

/** Central Express error handler. Mount last. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  const status = err instanceof HttpError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Internal error";
  if (status >= 500) console.error(err);
  res.status(status).json({ error: message });
}
