"use client";

// =====================================================================
// Discount-code CRUD (D6). One table, inline editing, one create row.
//
// The server is the authority on every rule (percentage ceiling, date window
// ordering, duplicate codes): this component shows the message it sends back
// rather than duplicating the validation, so the two can never disagree.
// =====================================================================

import { useState } from "react";
import { apiGet, apiSend, ApiError } from "@/lib/api";
import { dateShort } from "@/lib/format";
import type { DiscountCodeRow } from "@/lib/types";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  FieldLabel,
  SectionHeader,
  fieldClass,
  selectClass,
  tableClass,
  tableWrapClass,
  tdClass,
  thClass,
} from "@/components/ui";
import { Icon } from "@/components/icons";

interface FormState {
  code: string;
  kind: "percent" | "fixed";
  value: string;
  active: boolean;
  validFrom: string;
  validTo: string;
}

const EMPTY: FormState = {
  code: "",
  kind: "percent",
  value: "",
  active: true,
  validFrom: "",
  validTo: "",
};

/** ISO timestamp → the `yyyy-mm-dd` a date input wants (and back again). */
function toDateInput(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : "";
}

function fromDateInput(v: string): string | null {
  return v ? new Date(`${v}T00:00:00.000Z`).toISOString() : null;
}

function rowToForm(row: DiscountCodeRow): FormState {
  return {
    code: row.code,
    kind: row.kind,
    value: String(row.value),
    active: row.active,
    validFrom: toDateInput(row.validFrom),
    validTo: toDateInput(row.validTo),
  };
}

/** Live/expired/scheduled/off — the state that actually decides whether it applies. */
function statusOf(row: DiscountCodeRow): { label: string; tone: "green" | "amber" | "slate" | "red" } {
  if (!row.active) return { label: "Inactive", tone: "slate" };
  const now = Date.now();
  if (row.validFrom && new Date(row.validFrom).getTime() > now)
    return { label: "Scheduled", tone: "amber" };
  if (row.validTo && new Date(row.validTo).getTime() < now)
    return { label: "Expired", tone: "red" };
  return { label: "Live", tone: "green" };
}

export default function DiscountsEditor({ initial }: { initial: DiscountCodeRow[] }) {
  const [rows, setRows] = useState(initial);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function reload() {
    setRows(await apiGet<DiscountCodeRow[]>("/api/discounts"));
  }

  function reset() {
    setForm(EMPTY);
    setEditing(null);
    setError(null);
  }

  async function submit() {
    const value = Number(form.value);
    if (!form.code.trim() || !Number.isFinite(value) || value <= 0) {
      setError("A code and a positive value are required.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    const body = {
      code: form.code.trim().toUpperCase(),
      kind: form.kind,
      value,
      active: form.active,
      validFrom: fromDateInput(form.validFrom),
      validTo: fromDateInput(form.validTo),
    };
    try {
      if (editing) {
        await apiSend(`/api/discounts/${encodeURIComponent(editing)}`, "PUT", body);
        setNotice(`Updated ${editing}`);
      } else {
        await apiSend("/api/discounts", "POST", body);
        setNotice(`Created ${body.code}`);
      }
      await reload();
      reset();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save the code");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(row: DiscountCodeRow) {
    setBusy(true);
    setError(null);
    try {
      await apiSend(`/api/discounts/${encodeURIComponent(row.code)}`, "PUT", {
        kind: row.kind,
        value: row.value,
        active: !row.active,
        validFrom: row.validFrom,
        validTo: row.validTo,
      });
      await reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update the code");
    } finally {
      setBusy(false);
    }
  }

  async function remove(code: string) {
    if (!window.confirm(`Delete ${code}? Orders that already used it keep their frozen totals.`)) return;
    setBusy(true);
    setError(null);
    try {
      await apiSend(`/api/discounts/${encodeURIComponent(code)}`, "DELETE");
      await reload();
      if (editing === code) reset();
      setNotice(`Deleted ${code}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not delete the code");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card className="overflow-hidden">
        <SectionHeader title="Codes" description="Applied to the items subtotal, before extras and VAT" />
        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon="tag"
              title="No discount codes yet"
              description="Create one on the right; it becomes available on every draft order immediately."
            />
          </div>
        ) : (
          <div className={tableWrapClass + " rounded-none border-x-0 border-b-0"}>
            <div className="overflow-x-auto">
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th className={thClass}>Code</th>
                    <th className={thClass}>Discount</th>
                    <th className={thClass}>Status</th>
                    <th className={thClass}>Valid</th>
                    <th className={thClass + " text-right"}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const status = statusOf(row);
                    return (
                      <tr
                        key={row.code}
                        className={
                          "transition hover:bg-slate-50 " + (editing === row.code ? "bg-[#f5f5ff]" : "")
                        }
                      >
                        <td className={tdClass}>
                          <span className="font-mono text-sm font-bold text-slate-950">{row.code}</span>
                        </td>
                        <td className={tdClass + " font-semibold"}>
                          {row.kind === "percent" ? `${row.value}%` : `£${row.value.toFixed(2)}`}
                        </td>
                        <td className={tdClass}>
                          <Badge tone={status.tone}>{status.label}</Badge>
                        </td>
                        <td className={tdClass + " text-sm text-slate-500"}>
                          {row.validFrom || row.validTo
                            ? `${row.validFrom ? dateShort(row.validFrom) : "—"} → ${row.validTo ? dateShort(row.validTo) : "—"}`
                            : "Always"}
                        </td>
                        <td className={tdClass + " text-right"}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                setEditing(row.code);
                                setForm(rowToForm(row));
                                setError(null);
                              }}
                              className="inline-flex h-8 items-center rounded-md px-2 text-sm font-semibold text-[#4442e3] transition hover:bg-[#e7e6ff] disabled:opacity-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => toggleActive(row)}
                              className="inline-flex h-8 items-center rounded-md px-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
                            >
                              {row.active ? "Deactivate" : "Activate"}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => remove(row.code)}
                              aria-label={`Delete ${row.code}`}
                              className="inline-flex h-8 items-center rounded-md px-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                            >
                              <Icon name="trash" className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      <Card className="h-fit overflow-hidden">
        <SectionHeader
          title={editing ? `Edit ${editing}` : "New code"}
          actions={
            editing ? (
              <button
                type="button"
                onClick={reset}
                className="text-sm font-semibold text-slate-500 hover:text-slate-900"
              >
                Cancel
              </button>
            ) : undefined
          }
        />
        <div className="space-y-4 p-5">
          <label className="block">
            <FieldLabel>Code</FieldLabel>
            <input
              className={fieldClass + " font-mono uppercase"}
              value={form.code}
              disabled={Boolean(editing)}
              placeholder="SAVE10"
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <FieldLabel>Type</FieldLabel>
              <select
                className={selectClass}
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value as FormState["kind"] })}
              >
                <option value="percent">Percentage</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </label>
            <label className="block">
              <FieldLabel>{form.kind === "percent" ? "Percent (%)" : "Amount (£)"}</FieldLabel>
              <input
                className={fieldClass}
                inputMode="decimal"
                value={form.value}
                placeholder={form.kind === "percent" ? "10" : "50.00"}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <FieldLabel>Valid from</FieldLabel>
              <input
                type="date"
                className={fieldClass}
                value={form.validFrom}
                onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
              />
            </label>
            <label className="block">
              <FieldLabel>Valid to</FieldLabel>
              <input
                type="date"
                className={fieldClass}
                value={form.validTo}
                onChange={(e) => setForm({ ...form, validTo: e.target.value })}
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-[#4442e3] focus:ring-[#4442e3]"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Active
          </label>

          {error && <Alert tone="red" title={error} />}
          {notice && !error && <Alert tone="green" title={notice} />}

          <Button onClick={submit} disabled={busy} icon="check" className="w-full">
            {busy ? "Saving…" : editing ? "Save changes" : "Create code"}
          </Button>
          <p className="text-xs leading-5 text-slate-500">
            A fixed discount larger than the order&apos;s items subtotal makes the items free — it never
            produces a negative total. Confirmed orders keep the amount that was applied at the time.
          </p>
        </div>
      </Card>
    </div>
  );
}
