// =====================================================================
// api/middleware/auth.ts — JWT bearer authentication.
// =====================================================================

import type { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import { type AuthedRequest, type AuthUser, HttpError } from "../http.ts";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
}

/** Sign a token for a user. */
export function signToken(user: AuthUser): string {
  const expiresIn = process.env.JWT_EXPIRES_IN ?? "12h";
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn } as jwt.SignOptions,
  );
}

/** Require a valid Bearer token; attaches req.user. */
export function requireAuth(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    throw new HttpError(401, "Missing or malformed Authorization header");
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    };
    next();
  } catch {
    throw new HttpError(401, "Invalid or expired token");
  }
}

/** Require an authenticated admin. Use after requireAuth. */
export function requireAdmin(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction,
) {
  if (req.user?.role !== "admin") {
    throw new HttpError(403, "Admin role required");
  }
  next();
}
