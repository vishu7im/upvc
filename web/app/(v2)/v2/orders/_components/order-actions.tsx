"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  ButtonLink,
  Cluster,
  Drawer,
  Stack,
  TextField,
  useToast,
} from "@/components/v2";
import {
  ApiError,
  confirmOrder,
  createOrder,
  deleteDesignerLineItem,
  deleteOrder,
  deleteOrderItem,
  reopenOrder,
  updateOrder,
} from "@/lib/api";

function messageFor(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function NewOrderAction() {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (!busy) setOpen(false);
  }

  async function create() {
    if (!customerName.trim()) {
      setError("Customer name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const order = await createOrder({
        customerName: customerName.trim(),
        reference: reference.trim() || undefined,
      });
      showToast({ tone: "success", title: `${order.orderNo} created`, description: "The draft is ready for items." });
      router.push(`/v2/orders/${encodeURIComponent(order.id)}`);
      router.refresh();
    } catch (caught) {
      setError(messageFor(caught, "Could not create the order."));
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>New order</Button>
      <Drawer
        description="Create a draft first, then add configured items."
        footer={
          <Cluster>
            <Button disabled={busy} onClick={close} variant="secondary">Cancel</Button>
            <Button loading={busy} loadingLabel="Creating order" onClick={create}>Create draft</Button>
          </Cluster>
        }
        onClose={close}
        open={open}
        title="New order"
      >
        <Stack gap="form">
          <TextField
            autoComplete="organization"
            label="Customer name"
            onChange={(event) => setCustomerName(event.target.value)}
            required
            value={customerName}
          />
          <TextField
            hint="Optional; printed on order documents."
            label="Reference"
            onChange={(event) => setReference(event.target.value)}
            value={reference}
          />
          {error ? <Alert title="Could not create order" tone="error">{error}</Alert> : null}
        </Stack>
      </Drawer>
    </>
  );
}

export function EditOrderAction({
  customerName: initialCustomerName,
  orderId,
  reference: initialReference,
}: {
  customerName: string;
  orderId: string;
  reference: string | null;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [customerName, setCustomerName] = useState(initialCustomerName);
  const [reference, setReference] = useState(initialReference ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (!busy) setOpen(false);
  }

  async function save() {
    if (!customerName.trim()) {
      setError("Customer name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateOrder(orderId, {
        customerName: customerName.trim(),
        reference: reference.trim() || null,
      });
      setOpen(false);
      showToast({ tone: "success", title: "Order details saved" });
      router.refresh();
    } catch (caught) {
      setError(messageFor(caught, "Could not save the order details."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="secondary">Edit details</Button>
      <Drawer
        description="Customer and reference changes will appear on regenerated documents."
        footer={
          <Cluster>
            <Button disabled={busy} onClick={close} variant="secondary">Cancel</Button>
            <Button loading={busy} loadingLabel="Saving details" onClick={save}>Save details</Button>
          </Cluster>
        }
        onClose={close}
        open={open}
        title="Edit order details"
      >
        <Stack gap="form">
          <TextField label="Customer name" onChange={(event) => setCustomerName(event.target.value)} required value={customerName} />
          <TextField label="Reference" onChange={(event) => setReference(event.target.value)} value={reference} />
          {error ? <Alert title="Could not save changes" tone="error">{error}</Alert> : null}
        </Stack>
      </Drawer>
    </>
  );
}

export function DeleteOrderAction({ orderId, orderNo, status }: { orderId: string; orderNo: string; status: "draft" | "confirmed" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (!busy) setOpen(false);
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await deleteOrder(orderId);
      router.push("/v2/orders");
      router.refresh();
    } catch (caught) {
      setError(messageFor(caught, "Could not delete the order."));
      setBusy(false);
    }
  }

  return (
    <>
      <Button aria-label={`Delete order ${orderNo}`} onClick={() => setOpen(true)} variant="danger">Delete</Button>
      <Drawer
        description={`This permanently deletes ${orderNo} and all of its line items${status === "confirmed" ? ", generated documents, and cached PDFs" : ""}. This cannot be undone.`}
        footer={
          <Cluster>
            <Button disabled={busy} onClick={close} variant="secondary">Cancel</Button>
            <Button loading={busy} loadingLabel="Deleting order" onClick={remove} variant="danger">Delete order</Button>
          </Cluster>
        }
        onClose={close}
        open={open}
        title={`Delete ${orderNo}?`}
      >
        {error ? <Alert title="Could not delete order" tone="error">{error}</Alert> : (
          <Alert title="Permanent action" tone="warning">Only continue if this order is no longer required.</Alert>
        )}
      </Drawer>
    </>
  );
}

interface BlockedItem {
  id: string;
  position: number;
  issues: Array<{ severity: string; message: string }>;
}

export function ConfirmOrderAction({ disabled, orderId }: { disabled: boolean; orderId: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<BlockedItem[]>([]);

  async function confirm() {
    setBusy(true);
    setError(null);
    setBlocked([]);
    try {
      await confirmOrder(orderId);
      showToast({ tone: "success", title: "Order confirmed", description: "The document pack is ready." });
      router.push(`/v2/orders/${encodeURIComponent(orderId)}/documents`);
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        const items = (caught.payload as { items?: BlockedItem[] } | undefined)?.items;
        if (Array.isArray(items)) setBlocked(items);
      } else {
        setError("Could not confirm this order.");
      }
      setOpen(true);
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        disabled={disabled}
        loading={busy}
        loadingLabel="Confirming order"
        onClick={confirm}
        title={disabled ? "Add at least one item before confirming" : undefined}
      >
        Confirm order
      </Button>
      <Drawer
        description="Confirmation was stopped so the saved order and generated documents stay consistent."
        footer={
          <Cluster>
            <Button onClick={() => setOpen(false)} variant="secondary">Close</Button>
            <ButtonLink href={`/v2/orders/${encodeURIComponent(orderId)}/items`}>Review items</ButtonLink>
          </Cluster>
        }
        onClose={() => setOpen(false)}
        open={open}
        title="Order needs attention"
      >
        <Stack gap="card">
          {error ? <Alert title="Could not confirm order" tone="error">{error}</Alert> : null}
          {blocked.length > 0 ? (
            <ul className="v2-order-issues">
              {blocked.map((item) => (
                <li key={item.id}>
                  <strong>Item {item.position}</strong>
                  <ul>
                    {item.issues.filter((issue) => issue.severity === "error").map((issue, index) => (
                      <li key={`${item.id}-${index}`}>{issue.message}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : null}
        </Stack>
      </Drawer>
    </>
  );
}

export function ReopenOrderAction({ orderId, orderNo }: { orderId: string; orderNo: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (!busy) setOpen(false);
  }

  async function reopen() {
    setBusy(true);
    setError(null);
    try {
      await reopenOrder(orderId);
      setOpen(false);
      showToast({ tone: "success", title: `${orderNo} reopened`, description: "The order is editable again." });
      router.push(`/v2/orders/${encodeURIComponent(orderId)}/items`);
      router.refresh();
    } catch (caught) {
      setError(messageFor(caught, "Could not reopen this order."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="secondary">Reopen for editing</Button>
      <Drawer
        description="This returns the order to draft so its details and items can be changed."
        footer={
          <Cluster>
            <Button disabled={busy} onClick={close} variant="secondary">Cancel</Button>
            <Button loading={busy} loadingLabel="Reopening order" onClick={reopen}>Reopen order</Button>
          </Cluster>
        }
        onClose={close}
        open={open}
        title={`Reopen ${orderNo}?`}
      >
        <Stack gap="card">
          <Alert title="Documents will be regenerated" tone="warning">
            The seven generated documents and cached PDFs are removed. Confirming again creates a fresh document pack; existing PDF links will not work until then.
          </Alert>
          {error ? <Alert title="Could not reopen order" tone="error">{error}</Alert> : null}
        </Stack>
      </Drawer>
    </>
  );
}

export function RemoveOrderLineAction({ orderId, itemId, kind }: { orderId: string; itemId: string; kind: "legacy" | "designer" }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      if (kind === "designer") await deleteDesignerLineItem(orderId, itemId);
      else await deleteOrderItem(orderId, itemId);
      showToast({ tone: "success", title: "Item removed" });
      router.refresh();
    } catch (caught) {
      showToast({ tone: "error", title: "Could not remove item", description: messageFor(caught, "Try again.") });
      setBusy(false);
    }
  }

  return (
    <Button loading={busy} loadingLabel="Removing item" onClick={remove} variant="danger">Remove</Button>
  );
}
