"use client";

// New-order control (U4). Prompts for a customer name, creates a draft via
// the BFF, and navigates to the new order's detail page.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createOrder, ApiError } from "@/lib/api";
import { Button, fieldClass, FieldLabel } from "@/components/ui";

export default function NewOrderButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [customer, setCustomer] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!customer.trim()) {
      setError("Customer name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const order = await createOrder({
        customerName: customer.trim(),
        reference: reference.trim() || undefined,
      });
      router.push(`/orders/${order.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create order");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        icon="plus"
      >
        New order
      </Button>
    );
  }

  return (
    <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
        <label>
          <FieldLabel>Customer</FieldLabel>
          <input
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            placeholder="Customer name"
            className={fieldClass}
          />
        </label>
        <label>
          <FieldLabel>Reference</FieldLabel>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Optional"
            className={fieldClass}
          />
        </label>
        <Button onClick={create} disabled={busy} variant="success">
          {busy ? "Creating..." : "Create"}
        </Button>
        <Button onClick={() => setOpen(false)} variant="secondary">
          Cancel
        </Button>
      </div>
      {error && <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
