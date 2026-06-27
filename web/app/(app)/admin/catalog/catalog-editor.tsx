"use client";

// Catalog pricing editor (U5). Edit cost/price/weight per part across the
// profile/glass/gasket/hardware tables, manage colour uplifts + glass
// variants, and bulk-import prices via CSV. Every write hits the admin
// catalog API (which calls loadCatalog() so the engine sees new prices at once).

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateProfilePart,
  updateSubPart,
  addGlass,
  addColour,
  updateColour,
  importCatalogCsv,
  ApiError,
} from "@/lib/api";
import type { CatalogColour, CatalogDump, CatalogPart, SystemSummary } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  FieldLabel,
  fieldClass,
  selectClass,
  tableClass,
  tdClass,
  thClass,
} from "@/components/ui";
import { Icon } from "@/components/icons";

type SaveFn = (
  partKey: string,
  patch: { cost: number; price: number; weight: number; weldAllowanceMm?: number },
) => Promise<void>;

const PROFILE_GROUPS: { key: keyof CatalogDump; kind: string; label: string }[] = [
  { key: "frames", kind: "FRAME", label: "Frames" },
  { key: "sashes", kind: "SASH", label: "Sashes" },
  { key: "transoms", kind: "TRANSOM", label: "Transoms / mullions" },
  { key: "beads", kind: "BEAD", label: "Beads" },
  { key: "reinforcement", kind: "REINFORCEMENT", label: "Reinforcement" },
];

export default function CatalogEditor({ systems, dump }: { systems: SystemSummary[]; dump: CatalogDump }) {
  const router = useRouter();
  const sys = dump.systemId;

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-4 p-5 lg:flex-row lg:items-end lg:justify-between">
        <label className="block min-w-80">
          <FieldLabel>Profile system</FieldLabel>
          <select
            value={sys}
            onChange={(e) => router.push(`/admin/catalog?system=${e.target.value}`)}
            className={selectClass}
          >
            {systems.map((s) => (
              <option key={s.systemId} value={s.systemId}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <Badge tone="purple">{dump.currency}</Badge>
          <Badge tone="slate">{Object.keys(dump.frames).length + Object.keys(dump.sashes).length} core profiles</Badge>
          <Badge tone="green">{Object.keys(dump.glass).length} glass variants</Badge>
        </div>
      </Card>

      {PROFILE_GROUPS.map((g) => (
        <PriceTable
          key={g.key}
          title={g.label}
          rows={dump[g.key] as Record<string, CatalogPart>}
          showWeld
          onSave={(partKey, patch) => updateProfilePart(sys, g.kind, partKey, patch).then(() => {})}
          onSaved={() => router.refresh()}
        />
      ))}

      <PriceTable
        title="Glass"
        rows={dump.glass}
        onSave={(k, p) => updateSubPart(sys, "glass", k, p).then(() => {})}
        onSaved={() => router.refresh()}
      />
      <AddGlass systemId={sys} onAdded={() => router.refresh()} />

      <PriceTable
        title="Gaskets"
        rows={dump.gaskets}
        onSave={(k, p) => updateSubPart(sys, "gaskets", k, p).then(() => {})}
        onSaved={() => router.refresh()}
      />
      <PriceTable
        title="Hardware"
        rows={dump.hardware}
        onSave={(k, p) => updateSubPart(sys, "hardware", k, p).then(() => {})}
        onSaved={() => router.refresh()}
      />

      <Colours systemId={sys} colours={dump.colours} onChanged={() => router.refresh()} />
      <CsvImport systemId={sys} onDone={() => router.refresh()} />
    </div>
  );
}

// ---------- Price table + row ----------------------------------------

function PriceTable({
  title,
  rows,
  onSave,
  onSaved,
  showWeld = false,
}: {
  title: string;
  rows: Record<string, CatalogPart>;
  onSave: SaveFn;
  onSaved: () => void;
  showWeld?: boolean;
}) {
  const entries = Object.entries(rows ?? {});
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{entries.length} priced rows</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            aria-label={`Search ${title}`}
            placeholder="Search current table..."
            className="h-10 w-full rounded-md border border-slate-300 bg-white pl-10 pr-3 text-sm focus:border-[#4442e3] focus:ring-4 focus:ring-[#4442e3]/10"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Code</th>
              <th className={thClass}>Name</th>
              <th className={thClass + " w-32 text-right"}>Cost</th>
              <th className={thClass + " w-32 text-right"}>Price</th>
              <th className={thClass + " w-32 text-right"}>Weight</th>
              {showWeld && (
                <th className={thClass + " w-36 text-right"} title="Welding shrinkage per welded end (mm). 0 = inherit the global default from Settings.">
                  Weld /end (0=global)
                </th>
              )}
              <th className={thClass + " w-24"} />
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={showWeld ? 7 : 6} className="px-4 py-8 text-center text-sm text-slate-400">
                  None
                </td>
              </tr>
            ) : (
              entries.map(([key, row]) => (
                <PriceRow key={key} partKey={key} row={row} onSave={onSave} onSaved={onSaved} showWeld={showWeld} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function PriceRow({
  partKey,
  row,
  onSave,
  onSaved,
  showWeld = false,
}: {
  partKey: string;
  row: CatalogPart;
  onSave: SaveFn;
  onSaved: () => void;
  showWeld?: boolean;
}) {
  const [cost, setCost] = useState(row.cost);
  const [price, setPrice] = useState(row.price);
  const [weight, setWeight] = useState(row.weight);
  const [weld, setWeld] = useState(row.weldAllowanceMm ?? 0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const dirty =
    cost !== row.cost ||
    price !== row.price ||
    weight !== row.weight ||
    (showWeld && weld !== (row.weldAllowanceMm ?? 0));

  async function save() {
    setBusy(true);
    setErr(false);
    try {
      await onSave(partKey, showWeld ? { cost, price, weight, weldAllowanceMm: weld } : { cost, price, weight });
      onSaved();
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  }

  const inp = "h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-right text-sm focus:border-[#4442e3] focus:ring-4 focus:ring-[#4442e3]/10";

  return (
    <tr className={err ? "bg-red-50" : "transition hover:bg-slate-50"}>
      <td className={tdClass + " font-mono text-xs text-slate-600"}>{row.code}</td>
      <td className={tdClass + " font-semibold text-slate-900"}>{row.name}</td>
      <td className={tdClass}>
        <input type="number" step="0.01" value={cost} onChange={(e) => setCost(+e.target.value)} className={inp} />
      </td>
      <td className={tdClass}>
        <input type="number" step="0.01" value={price} onChange={(e) => setPrice(+e.target.value)} className={inp} />
      </td>
      <td className={tdClass}>
        <input type="number" step="0.001" value={weight} onChange={(e) => setWeight(+e.target.value)} className={inp} />
      </td>
      {showWeld && (
        <td className={tdClass}>
          <input
            type="number"
            step="0.1"
            min="0"
            value={weld}
            onChange={(e) => setWeld(+e.target.value)}
            className={inp}
            aria-label={`Weld allowance per end for ${row.name}`}
          />
        </td>
      )}
      <td className={tdClass + " text-right"}>
        <Button
          onClick={save}
          disabled={!dirty || busy}
          className="h-8 px-3 text-xs"
        >
          {busy ? "..." : "Save"}
        </Button>
      </td>
    </tr>
  );
}

// ---------- Add glass variant ----------------------------------------

function AddGlass({ systemId, onAdded }: { systemId: string; onAdded: () => void }) {
  const [f, setF] = useState({ partKey: "", code: "", name: "", cost: 0, price: 0 });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    setMsg(null);
    try {
      await addGlass(systemId, f);
      setF({ partKey: "", code: "", name: "", cost: 0, price: 0 });
      onAdded();
      setMsg("Added.");
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-dashed p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-950">Add glass variant</h3>
        <Badge tone="blue">Glass</Badge>
      </div>
      <div className="grid gap-3 md:grid-cols-5 lg:grid-cols-[1fr_1fr_2fr_120px_120px_auto]">
      <input placeholder="partKey" value={f.partKey} onChange={(e) => setF({ ...f, partKey: e.target.value })} className={fieldClass} />
      <input placeholder="code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} className={fieldClass} />
      <input placeholder="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={fieldClass} />
      <input type="number" placeholder="cost" value={f.cost} onChange={(e) => setF({ ...f, cost: +e.target.value })} className={fieldClass} />
      <input type="number" placeholder="price" value={f.price} onChange={(e) => setF({ ...f, price: +e.target.value })} className={fieldClass} />
      <Button onClick={add} disabled={busy || !f.partKey || !f.code || !f.name} variant="success">
        Add
      </Button>
      </div>
      {msg && <p className="mt-3 text-sm text-slate-500">{msg}</p>}
    </Card>
  );
}

// ---------- Colours --------------------------------------------------

function Colours({
  systemId,
  colours,
  onChanged,
}: {
  systemId: string;
  colours: Record<string, CatalogColour>;
  onChanged: () => void;
}) {
  const [nf, setNf] = useState({ key: "", code: "", name: "", costUpliftPct: 0, priceUpliftPct: 0 });
  const [msg, setMsg] = useState<string | null>(null);

  async function add() {
    setMsg(null);
    try {
      await addColour(systemId, nf);
      setNf({ key: "", code: "", name: "", costUpliftPct: 0, priceUpliftPct: 0 });
      onChanged();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Failed");
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-950">Colours / finishes</h2>
        <p className="mt-1 text-sm text-slate-500">Manage colour uplifts and base finish markers.</p>
      </div>
      <div className="overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Key</th>
              <th className={thClass}>Name</th>
              <th className={thClass + " w-36 text-right"}>Cost uplift %</th>
              <th className={thClass + " w-36 text-right"}>Price uplift %</th>
              <th className={thClass + " w-24"} />
            </tr>
          </thead>
          <tbody>
            {Object.values(colours ?? {}).map((c) => (
              <ColourRow key={c.key} systemId={systemId} colour={c} onSaved={onChanged} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="m-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-950">Add colour</h3>
        <div className="grid gap-3 md:grid-cols-5 lg:grid-cols-[1fr_1fr_2fr_120px_120px_auto]">
        <input placeholder="key" value={nf.key} onChange={(e) => setNf({ ...nf, key: e.target.value })} className={fieldClass} />
        <input placeholder="code" value={nf.code} onChange={(e) => setNf({ ...nf, code: e.target.value })} className={fieldClass} />
        <input placeholder="name" value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} className={fieldClass} />
        <input type="number" placeholder="cost %" value={nf.costUpliftPct} onChange={(e) => setNf({ ...nf, costUpliftPct: +e.target.value })} className={fieldClass} />
        <input type="number" placeholder="price %" value={nf.priceUpliftPct} onChange={(e) => setNf({ ...nf, priceUpliftPct: +e.target.value })} className={fieldClass} />
        <Button onClick={add} disabled={!nf.key || !nf.code || !nf.name} variant="success">
          Add
        </Button>
        </div>
        {msg && <p className="mt-3 text-sm text-red-600">{msg}</p>}
      </div>
    </Card>
  );
}

function ColourRow({
  systemId,
  colour,
  onSaved,
}: {
  systemId: string;
  colour: CatalogColour;
  onSaved: () => void;
}) {
  const [costPct, setCostPct] = useState(colour.costUpliftPct);
  const [pricePct, setPricePct] = useState(colour.priceUpliftPct);
  const [busy, setBusy] = useState(false);
  const dirty = costPct !== colour.costUpliftPct || pricePct !== colour.priceUpliftPct;
  const inp = "h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-right text-sm focus:border-[#4442e3] focus:ring-4 focus:ring-[#4442e3]/10";

  async function save() {
    setBusy(true);
    try {
      await updateColour(systemId, colour.key, { costUpliftPct: costPct, priceUpliftPct: pricePct });
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="transition hover:bg-slate-50">
      <td className={tdClass + " font-mono text-xs text-slate-600"}>
        {colour.key}
        {colour.isBase && <span className="ml-1 text-slate-400">(base)</span>}
      </td>
      <td className={tdClass + " font-semibold text-slate-900"}>{colour.name}</td>
      <td className={tdClass}>
        <input type="number" step="0.1" value={costPct} onChange={(e) => setCostPct(+e.target.value)} className={inp} />
      </td>
      <td className={tdClass}>
        <input type="number" step="0.1" value={pricePct} onChange={(e) => setPricePct(+e.target.value)} className={inp} />
      </td>
      <td className={tdClass + " text-right"}>
        <Button
          onClick={save}
          disabled={!dirty || busy}
          className="h-8 px-3 text-xs"
        >
          {busy ? "..." : "Save"}
        </Button>
      </td>
    </tr>
  );
}

// ---------- CSV import -----------------------------------------------

function CsvImport({ systemId, onDone }: { systemId: string; onDone: () => void }) {
  const [csv, setCsv] = useState("code,cost,price\n");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ updated: number; unmatched: string[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const r = await importCatalogCsv(systemId, csv);
      setResult({ updated: r.updated, unmatched: r.unmatched });
      onDone();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-950">CSV price import</h2>
        <p className="mt-1 text-sm text-slate-500">
          Header <code className="rounded bg-slate-100 px-1 font-mono">code,cost,price</code>; rows matched by part code across all tables.
        </p>
      </div>
      <div className="p-5">
      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        rows={5}
        className="w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-xs text-slate-800 focus:border-[#4442e3] focus:ring-4 focus:ring-[#4442e3]/10"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button onClick={run} disabled={busy} icon="download">
          {busy ? "Importing..." : "Import CSV"}
        </Button>
        {result && (
          <span className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Updated {result.updated}
            {result.unmatched.length > 0 && ` · unmatched: ${result.unmatched.join(", ")}`}
          </span>
        )}
        {err && <span className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</span>}
      </div>
      </div>
    </Card>
  );
}
