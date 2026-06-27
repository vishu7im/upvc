// =====================================================================
// db/client.ts — single shared PrismaClient instance.
//
// Import this everywhere instead of `new PrismaClient()` so we don't
// exhaust the connection pool (especially under tsx watch / hot reload).
// =====================================================================

import { PrismaClient } from "@prisma/client";

// Reuse a single client across module reloads in dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
