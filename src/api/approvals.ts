// =====================================================================
// api/approvals.ts — peer-consent workflow for Super Admin deletion.
// Participants are authenticated platform users; each transition also checks
// that the caller is the request target or requester as appropriate.
// =====================================================================

import { Router } from "express";
import { prisma } from "../db/client.ts";
import { asyncHandler, type AuthedRequest, HttpError } from "./http.ts";
import {
  assertManageableUser,
  assertNotLastSuperAdmin,
  writeAuditLog,
} from "./rbac/service.ts";

export const approvalsRouter = Router();

const APPROVAL_SELECT = {
  id: true,
  status: true,
  reason: true,
  createdAt: true,
  resolvedAt: true,
  resolvedById: true,
  targetId: true,
  requesterId: true,
  target: { select: { id: true, name: true, email: true } },
  requester: { select: { id: true, name: true, email: true } },
} as const;

async function pendingRequest(id: string) {
  const request = await prisma.accountDeletionRequest.findUnique({
    where: { id },
    select: APPROVAL_SELECT,
  });
  if (!request) throw new HttpError(404, "Approval request not found");
  if (request.status !== "PENDING") {
    throw new HttpError(409, "Approval request has already been resolved");
  }
  return request;
}

approvalsRouter.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.auth!.user.id;
    const [incoming, outgoing] = await Promise.all([
      prisma.accountDeletionRequest.findMany({
        where: { targetId: userId, status: "PENDING" },
        orderBy: { createdAt: "desc" },
        select: APPROVAL_SELECT,
      }),
      prisma.accountDeletionRequest.findMany({
        where: { requesterId: userId, status: "PENDING" },
        orderBy: { createdAt: "desc" },
        select: APPROVAL_SELECT,
      }),
    ]);
    res.json({ incoming, outgoing });
  }),
);

approvalsRouter.post(
  "/:id/approve",
  asyncHandler(async (req: AuthedRequest, res) => {
    const request = await pendingRequest(req.params.id);
    if (request.targetId !== req.auth!.user.id) {
      throw new HttpError(403, "Only the target Super Admin can approve this request");
    }
    if (!request.targetId) throw new HttpError(409, "Approval target no longer exists");

    const target = await assertManageableUser(req.auth!, request.targetId);
    if (target.roleScope !== "PLATFORM") {
      throw new HttpError(409, "Approval target is no longer a Super Admin");
    }
    await assertNotLastSuperAdmin(target.id);

    const orderCount = await prisma.order.count({ where: { userId: target.id } });
    if (orderCount > 0) {
      throw new HttpError(409, "User has orders and cannot be deleted; deactivate instead");
    }

    const resolvedAt = new Date();
    await prisma.$transaction([
      prisma.accountDeletionRequest.update({
        where: { id: request.id },
        data: {
          status: "EXECUTED",
          resolvedAt,
          resolvedById: target.id,
        },
      }),
      prisma.user.delete({ where: { id: target.id } }),
    ]);

    await writeAuditLog({
      actorId: request.requesterId,
      action: "user.delete",
      targetType: "user",
      targetId: target.id,
      detail: {
        requestId: request.id,
        approvedByTargetId: target.id,
      },
    });
    res.json({ ok: true, status: "executed" });
  }),
);

approvalsRouter.post(
  "/:id/reject",
  asyncHandler(async (req: AuthedRequest, res) => {
    const request = await pendingRequest(req.params.id);
    if (request.targetId !== req.auth!.user.id) {
      throw new HttpError(403, "Only the target Super Admin can reject this request");
    }

    const resolvedAt = new Date();
    await prisma.accountDeletionRequest.update({
      where: { id: request.id },
      data: { status: "REJECTED", resolvedAt, resolvedById: req.auth!.user.id },
    });
    await writeAuditLog({
      actorId: req.auth!.user.id,
      action: "user.delete_rejected",
      targetType: "user",
      targetId: request.targetId,
      detail: { requestId: request.id },
    });
    res.json({ ok: true, status: "rejected" });
  }),
);

approvalsRouter.post(
  "/:id/cancel",
  asyncHandler(async (req: AuthedRequest, res) => {
    const request = await pendingRequest(req.params.id);
    if (request.requesterId !== req.auth!.user.id) {
      throw new HttpError(403, "Only the requester can cancel this request");
    }

    const resolvedAt = new Date();
    await prisma.accountDeletionRequest.update({
      where: { id: request.id },
      data: { status: "CANCELLED", resolvedAt, resolvedById: req.auth!.user.id },
    });
    await writeAuditLog({
      actorId: req.auth!.user.id,
      action: "user.delete_cancelled",
      targetType: "user",
      targetId: request.targetId,
      detail: { requestId: request.id },
    });
    res.json({ ok: true, status: "cancelled" });
  }),
);
