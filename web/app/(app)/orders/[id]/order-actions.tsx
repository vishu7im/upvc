"use client";

// Draft-order actions (U4): remove a line item, or confirm the order (which
// generates the 7 documents server-side). Both refresh the Server Component
// so the page reflects the new state.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteOrderItem, deleteDesignerLineItem, confirmOrder, ApiError } from "@/lib/api";
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

/** Same action for a Designer line item (D2 persists them in their own table). */
export function RemoveDesignerItemButton({ orderId, itemId }: { orderId: string; itemId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      await deleteDesignerLineItem(orderId, itemId);
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

/** The 422 body confirm returns when a designer item still has error issues. */
interface BlockedItem {
  id: string;
  position: number;
  issues: { severity: string; message: string }[];
}

export function ConfirmOrderButton({ orderId, disabled }: { orderId: string; disabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<BlockedItem[]>([]);

  async function confirm() {
    setBusy(true);
    setError(null);
    setBlocked([]);
    try {
      await confirmOrder(orderId);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
        // 422 ⇒ "which item, and why" — show it rather than a bare sentence.
        const items = (e.payload as { items?: BlockedItem[] } | undefined)?.items;
        if (Array.isArray(items)) setBlocked(items);
      } else {
        setError("Could not confirm");
      }
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-3 sm:items-end">
      <Button
        onClick={confirm}
        disabled={busy || disabled}
        variant="success"
        icon="check"
        title={disabled ? "Add at least one item first" : undefined}
        className="self-start sm:self-auto"
      >
        {busy ? "Confirming..." : "Confirm order"}
      </Button>
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <p className="font-semibold">{error}</p>
          {blocked.length > 0 && (
            <ul className="mt-2 space-y-2">
              {blocked.map((item) => (
                <li key={item.id}>
                  <span className="font-semibold">Item {item.position}</span>
                  <ul className="ml-4 list-disc">
                    {item.issues
                      .filter((i) => i.severity === "error")
                      .map((issue, i) => (
                        <li key={i}>{issue.message}</li>
                      ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
