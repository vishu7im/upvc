"use client";

// Draft-order actions (U4): remove a line item, or confirm the order (which
// generates the 7 documents server-side). Both refresh the Server Component
// so the page reflects the new state.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteOrderItem, confirmOrder, ApiError } from "@/lib/api";
import { Button } from "@/components/ui";

export function RemoveItemButton({ orderId, itemId }: { orderId: string; itemId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      await deleteOrderItem(orderId, itemId);
      router.refresh();
    } catch {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={remove}
      disabled={busy}
      className="inline-flex h-8 items-center rounded-md px-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
    >
      {busy ? "Removing..." : "Remove"}
    </button>
  );
}

export function ConfirmOrderButton({ orderId, disabled }: { orderId: string; disabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await confirmOrder(orderId);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not confirm");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        onClick={confirm}
        disabled={busy || disabled}
        variant="success"
        icon="check"
        title={disabled ? "Add at least one item first" : undefined}
      >
        {busy ? "Confirming..." : "Confirm order"}
      </Button>
      {error && <span className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</span>}
    </div>
  );
}
