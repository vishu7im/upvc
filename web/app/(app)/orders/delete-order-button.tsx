"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, deleteOrder } from "@/lib/api";
import { Alert, Button, Card } from "@/components/ui";

export default function DeleteOrderButton({
  orderId,
  orderNo,
  status,
  compact = false,
}: {
  orderId: string;
  orderNo: string;
  status: "draft" | "confirmed";
  compact?: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await deleteOrder(orderId);
      router.push("/orders");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete order");
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="danger"
        icon="trash"
        className={compact ? "h-8 px-3" : undefined}
        onClick={() => setConfirming(true)}
        aria-label={`Delete order ${orderNo}`}
      >
        Delete
      </Button>

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`delete-order-${orderId}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) setConfirming(false);
          }}
        >
          <Card className="w-full max-w-md p-5 shadow-2xl">
            <h2 id={`delete-order-${orderId}`} className="text-xl font-bold text-slate-950">
              Delete {orderNo}?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This permanently deletes the order and all of its line items
              {status === "confirmed" ? ", generated documents, and cached PDFs" : ""}. This action cannot be undone.
            </p>

            {error && (
              <div className="mt-4">
                <Alert tone="red" title="Could not delete order">{error}</Alert>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="danger" icon="trash" onClick={remove} disabled={busy}>
                {busy ? "Deleting..." : "Delete order"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
