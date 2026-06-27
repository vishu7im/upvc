// =====================================================================
// api/auth.ts — login / register / me.
// =====================================================================

import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db/client.ts";
import { asyncHandler, type AuthedRequest, HttpError, validate } from "./http.ts";
import { requireAdmin, requireAuth, signToken } from "./middleware/auth.ts";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().min(1), // lookup key; format not enforced on login
  password: z.string().min(1),
});

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = validate(loginSchema, req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new HttpError(401, "Invalid email or password");
    }
    const pub = { id: user.id, email: user.email, name: user.name, role: user.role };
    res.json({ token: signToken(pub), user: pub });
  }),
);

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z.enum(["user", "admin"]).optional(),
});

// Admin-guarded: only an admin can create new users.
authRouter.post(
  "/register",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { email, password, name, role } = validate(registerSchema, req.body);
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) throw new HttpError(409, "Email already registered");
    const user = await prisma.user.create({
      data: {
        email,
        name,
        role: role ?? "user",
        passwordHash: await bcrypt.hash(password, 10),
      },
    });
    res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw new HttpError(404, "User not found");
    res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
  }),
);
