"use client";

// Settings + branding form (U5). Financial fields + company branding → PUT
// /api/settings; logo via a raw image POST. Refreshes on save.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateSettings, uploadLogo, ApiError } from "@/lib/api";
import type { SettingsResponse } from "@/lib/types";
import { Badge, Button, Card, FieldLabel, fieldClass } from "@/components/ui";
import { Icon } from "@/components/icons";

export default function SettingsForm({ initial }: { initial: SettingsResponse }) {
  const router = useRouter();
  const [f, setF] = useState({
    currency: initial.currency,
    taxApply: initial.taxApply,
    taxPct: initial.taxPct,
    markupPct: initial.markupPct,
    wastagePct: initial.wastagePct,
    labourPerSash: initial.labourPerSash,
    labourPerDoor: initial.labourPerDoor,
    labourBase: initial.labourBase,
    weldAllowanceMm: initial.weldAllowanceMm,
    companyName: initial.branding.companyName ?? "",
    companyAddress: initial.branding.companyAddress ?? "",
    accentColor: initial.branding.accentColor ?? "#1f6feb",
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [logoBust, setLogoBust] = useState(0);

  const num = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: parseFloat(e.target.value) || 0 });
  const str = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.value });

  async function save() {
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      await updateSettings(f);
      setMsg("Saved.");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      await uploadLogo(file);
      setMsg("Logo uploaded.");
      setLogoBust(Date.now());
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Logo upload failed");
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-950">Financial rules</h2>
          <p className="mt-1 text-sm text-slate-500">Defaults used by the quote engine for tax, wastage, markup, and labour.</p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <Num label="Currency code" value={f.currency} onChange={str("currency")} text />
          <Num label="Tax %" value={f.taxPct} onChange={num("taxPct")} />
          <Num label="Markup %" value={f.markupPct} onChange={num("markupPct")} />
          <Num label="Wastage %" value={f.wastagePct} onChange={num("wastagePct")} />
          <Num label="Labour / sash" value={f.labourPerSash} onChange={num("labourPerSash")} />
          <Num label="Labour / door" value={f.labourPerDoor} onChange={num("labourPerDoor")} />
          <Num label="Labour base" value={f.labourBase} onChange={num("labourBase")} />
          <Num label="Weld allowance (mm/end)" value={f.weldAllowanceMm} onChange={num("weldAllowanceMm")} />
          <label className="flex h-11 items-center gap-3 self-end rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={f.taxApply}
              onChange={(e) => setF({ ...f, taxApply: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-[#4442e3]"
            />
            Apply tax
          </label>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-950">Brand identity</h2>
          <p className="mt-1 text-sm text-slate-500">Company metadata and logo used on generated documents.</p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Num label="Company name" value={f.companyName} onChange={str("companyName")} text />
          <Num label="Company address" value={f.companyAddress} onChange={str("companyAddress")} text />
          <label className="block">
            <FieldLabel>Accent colour</FieldLabel>
            <div className="flex h-11 items-center gap-3 rounded-md border border-slate-300 bg-white px-3">
              <span className="h-6 w-6 rounded-sm border border-slate-200" style={{ background: f.accentColor }} />
              <input type="text" value={f.accentColor} onChange={str("accentColor")} className="min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold outline-none" />
              <input type="color" value={f.accentColor} onChange={str("accentColor")} className="h-7 w-8 cursor-pointer rounded border border-slate-200 bg-white p-0" />
            </div>
          </label>
          <div>
            <FieldLabel>Logo</FieldLabel>
            {initial.branding.hasLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/branding/logo${logoBust ? `?b=${logoBust}` : ""}`}
                alt="Company logo"
                className="mb-3 h-14 w-auto rounded-md border border-slate-200 bg-white object-contain p-2"
              />
            )}
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-600 transition hover:border-[#4442e3] hover:text-[#4442e3]">
              <Icon name="download" className="h-4 w-4" />
              Upload logo
              <input type="file" accept="image/*" onChange={onLogo} className="sr-only" />
            </label>
          </div>
        </div>
      </Card>
      </div>

      <Card className="h-fit p-5 xl:sticky xl:top-20">
        <p className="text-xs font-semibold uppercase text-slate-500">Review</p>
        <h2 className="mt-2 text-xl font-bold text-slate-950">{f.companyName || "Company name"}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{f.companyAddress || "Company address"}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Badge tone={f.taxApply ? "green" : "amber"}>{f.taxApply ? "Tax enabled" : "Tax disabled"}</Badge>
          <Badge tone="purple">{f.markupPct}% markup</Badge>
          <Badge tone="slate">{f.wastagePct}% wastage</Badge>
        </div>
        <Button onClick={save} disabled={busy} className="mt-6 w-full" icon="check">
          {busy ? "Saving..." : "Apply changes"}
        </Button>
        {msg && <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>}
        {error && <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </Card>
    </div>
  );
}

function Num({
  label,
  value,
  onChange,
  text,
}: {
  label: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  text?: boolean;
}) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <input
        type={text ? "text" : "number"}
        value={value}
        onChange={onChange}
        className={fieldClass}
      />
    </label>
  );
}
