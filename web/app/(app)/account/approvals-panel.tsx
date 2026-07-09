"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, approveDeletion, cancelDeletion, rejectDeletion } from "@/lib/api";
import type { ApprovalRequest, ApprovalsInbox } from "@/lib/types";
import { Alert, Badge, Button, Card, SectionHeader } from "@/components/ui";

function createdAt(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export default function ApprovalsPanel({
  initial,
  isSuperAdmin,
}: {
  initial: ApprovalsInbox;
  isSuperAdmin: boolean;
}) {
  const router = useRouter();
  const [inbox, setInbox] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(id: string, action: () => Promise<unknown>, removeFrom: "incoming" | "outgoing") {
    setBusyId(id);
    setError(null);
    try {
      await action();
      setInbox((current) => ({ ...current, [removeFrom]: current[removeFrom].filter((request) => request.id !== id) }));
      setConfirmId(null);
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not resolve approval");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function approve(request: ApprovalRequest) {
    const ok = await run(request.id, () => approveDeletion(request.id), "incoming");
    if (ok) {
      router.replace("/login");
      router.refresh();
    }
  }

  if (!isSuperAdmin && inbox.incoming.length === 0 && inbox.outgoing.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-sm text-slate-600">There are no account approvals for this profile.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {error && <Alert tone="red" title="Could not resolve approval">{error}</Alert>}

      <Card>
        <SectionHeader
          title="Pending approvals"
          description="Deletion requests that require your decision."
          actions={inbox.incoming.length > 0 ? <Badge tone="amber">{inbox.incoming.length} pending</Badge> : undefined}
        />
        {inbox.incoming.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">No requests are waiting for your approval.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {inbox.incoming.map((request) => (
              <div key={request.id} className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-950">{request.requester.name} requested deletion of your account</p>
                    <p className="mt-1 text-sm text-slate-500">{request.requester.email} - {createdAt(request.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="danger" onClick={() => setConfirmId(request.id)} disabled={busyId === request.id}>Approve</Button>
                    <Button variant="secondary" onClick={() => run(request.id, () => rejectDeletion(request.id), "incoming")} disabled={busyId === request.id}>Reject</Button>
                  </div>
                </div>
                {confirmId === request.id && (
                  <div className="mt-4 border-t border-red-200 pt-4">
                    <Alert tone="red" title="Approve account deletion?">Your account will be deleted and you will be signed out.</Alert>
                    <div className="mt-3 flex gap-2">
                      <Button variant="danger" onClick={() => approve(request)} disabled={busyId === request.id}>
                        {busyId === request.id ? "Deleting..." : "Confirm approval"}
                      </Button>
                      <Button variant="secondary" onClick={() => setConfirmId(null)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <SectionHeader title="Requests you made" description="Pending deletion requests awaiting the other Super Admin." />
        {inbox.outgoing.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">You have no pending requests.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {inbox.outgoing.map((request) => (
              <div key={request.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-slate-950">{request.target?.name ?? "Deleted user"}</p>
                  <p className="mt-1 text-sm text-slate-500">{request.target?.email ?? "Account unavailable"} - {createdAt(request.createdAt)}</p>
                </div>
                <Button variant="secondary" onClick={() => run(request.id, () => cancelDeletion(request.id), "outgoing")} disabled={busyId === request.id}>
                  {busyId === request.id ? "Cancelling..." : "Cancel request"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
