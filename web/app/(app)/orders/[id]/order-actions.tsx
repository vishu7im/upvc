"use client";

// Draft-order actions (U4): remove a line item, or confirm the order (which
// generates the 7 documents server-side). Both refresh the Server Component
// so the page reflects the new state.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteOrderItem,
  deleteDesignerLineItem,
  confirmOrder,
  reopenOrder,
  updateOrder,
  ApiError,
} from "@/lib/api";
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

/**
 * Put a confirmed order back into draft (owner 2026-08-05).
 *
 * Confirmed used to be terminal — the only way to correct a mistake was to
 * delete the order and rebuild it. Reopening deletes the 7 stored documents and
 * purges their cached PDFs, so the modal says so plainly: nothing is lost that
 * re-confirming does not regenerate, but any link someone already has to a PDF
 * stops working until then.
 */
export function ReopenOrderButton({ orderId, orderNo }: { orderId: string; orderNo: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reopen() {
    setBusy(true);
    setError(null);
    try {
      await reopenOrder(orderId);
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not reopen this order");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="secondary" icon="arrowLeft">
        Reopen for editing
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-lg">
            <h2 className="text-base font-bold text-slate-950">Reopen {orderNo}?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This puts the order back into draft so its items can be changed. The 7 generated
              documents and their PDFs are removed and will be regenerated when you confirm again.
            </p>
            {error && (
              <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button onClick={() => setOpen(false)} variant="secondary" disabled={busy}>
                Cancel
              </Button>
              <Button onClick={reopen} disabled={busy} icon="arrowLeft">
                {busy ? "Reopening..." : "Reopen order"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Inline edit for the order's customer and reference. Both print on every
 * document, so this is a draft-only edit like any other order mutation.
 */
export function EditOrderDetails({
  orderId,
  customerName,
  reference,
}: {
  orderId: string;
  customerName: string;
  reference: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(customerName);
  const [ref, setRef] = useState(reference ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) {
      setError("Customer name cannot be empty.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateOrder(orderId, { customerName: name.trim(), reference: ref.trim() || null });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save these details");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 text-sm font-semibold text-[#4442e3] transition hover:underline"
      >
        Edit details
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Customer name"
        className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
      />
      <input
        value={ref}
        onChange={(e) => setRef(e.target.value)}
        placeholder="Reference (optional)"
        className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
      />
      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={save} disabled={busy} className="h-8">
          {busy ? "Saving..." : "Save"}
        </Button>
        <Button onClick={() => setOpen(false)} variant="secondary" disabled={busy} className="h-8">
          Cancel
        </Button>
      </div>
    </div>
  );
}
