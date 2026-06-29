"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, quote, createOrder, addOrderItem, ApiError } from "@/lib/api";
import type { QuoteResult, SystemOptions, SystemSummary } from "@/lib/types";
import { normalizeSvgForPreview } from "@/lib/svg-preview";
import WindowDesigner from "@/components/window-designer";
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  FieldLabel,
  PageHeader,
  fieldClass,
  selectClass,
} from "@/components/ui";
import { Icon } from "@/components/icons";
import { ToastViewport, type ToastKind, type ToastState } from "@/components/toast";

type Status = "idle" | "updating" | "valid" | "invalid";

const STATUS_META: Record<Status, { label: string; tone: "slate" | "amber" | "green" | "red" }> = {
  idle: { label: "Waiting", tone: "slate" },
  updating: { label: "Updating…", tone: "amber" },
  valid: { label: "Valid configuration", tone: "green" },
  invalid: { label: "Invalid configuration", tone: "red" },
};

export interface ConfiguratorProps {
  designId?: string;
  productId?: string;
  designName?: string;
  systemId?: string;
  orderId?: string;
  designSvg?: string | null;
  /** The design's baked frame profile (chamber); pre-selects the Chamber dropdown. */
  designFrameKey?: string | null;
}

export default function Configurator(props: ConfiguratorProps) {
  const router = useRouter();

  const [systems, setSystems] = useState<SystemSummary[]>([]);
  const [systemId, setSystemId] = useState(props.systemId ?? "");
  const [options, setOptions] = useState<SystemOptions | null>(null);

  const [width, setWidth] = useState(1200);
  const [height, setHeight] = useState(1200);
  const [glassKey, setGlassKey] = useState("");
  const [colourKey, setColourKey] = useState("");
  // Per-quote chamber selection. Defaults to the design's baked frame; switching
  // it swaps the frame profile (e.g. 5ch→6ch faceWidth) for the whole quote.
  const [chamberKey, setChamberKey] = useState(props.designFrameKey ?? "");
  // Per-quote cill selection. "" ⇒ no cill (no 30mm manufacturing-height deduction).
  const [cillKey, setCillKey] = useState("");
  // Per-quote internal split overrides (multi-span editing), keyed by split-node
  // pathId; full-window fractions. Empty ⇒ the design's baked splits.
  const [splitRatios, setSplitRatios] = useState<Record<string, number>>({});

  const [result, setResult] = useState<QuoteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Transient feedback toast + suppression of the initial-load solve (so visiting
  // the page doesn't greet the user with "Updating → success" noise).
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastSeq = useRef(0);
  const settledOnceRef = useRef(false);
  const showToast = useCallback((kind: ToastKind) => {
    setToast({ id: ++toastSeq.current, kind });
  }, []);
  const expireToast = useCallback((id: number) => {
    setToast((cur) => (cur && cur.id === id ? null : cur));
  }, []);

  const [customer, setCustomer] = useState("");
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<SystemSummary[]>("/api/systems")
      .then((s) => {
        setSystems(s);
        if (!props.systemId && s[0]) setSystemId(s[0].systemId);
      })
      .catch(() => setError("Engine API not reachable."));
  }, [props.systemId]);

  useEffect(() => {
    if (!systemId) return;
    apiGet<SystemOptions>(`/api/systems/${systemId}/options`)
      .then((o) => {
        setOptions(o);
        setColourKey(o.defaultColourKey ?? "");
        setGlassKey("");
        setCillKey("");
      })
      .catch(() => setOptions(null));
  }, [systemId]);

  // Reset split overrides when the design changes — the pathId scheme is
  // design-specific. (Width/height changes keep them: full-window fractions
  // scale panels proportionally.) Render-phase reset per the React docs pattern.
  const [splitDesignId, setSplitDesignId] = useState(props.designId);
  if (splitDesignId !== props.designId) {
    setSplitDesignId(props.designId);
    setSplitRatios({});
  }

  const runQuote = useCallback(() => {
    if (!props.designId || !systemId || width <= 0 || height <= 0) return;
    setLoading(true);
    setError(null);
    if (settledOnceRef.current) showToast("updating");
    quote({
      systemId,
      designId: props.designId,
      widthMm: width,
      heightMm: height,
      frameKey: chamberKey || undefined,
      glassKey: glassKey || undefined,
      colourKey: colourKey || undefined,
      cillKey: cillKey || undefined,
      splitRatios: Object.keys(splitRatios).length ? splitRatios : undefined,
    })
      .then((r) => {
        setResult(r);
        if (settledOnceRef.current) showToast("valid");
        settledOnceRef.current = true;
      })
      .catch((e) => {
        setError(e instanceof ApiError ? e.message : "Quote failed");
        showToast("invalid");
      })
      .finally(() => setLoading(false));
  }, [props.designId, systemId, width, height, chamberKey, glassKey, colourKey, cillKey, splitRatios, showToast]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(runQuote, 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [runQuote]);

  async function onAddToOrder() {
    if (!props.designId || !props.productId) return;
    setAdding(true);
    setAddError(null);
    const item = {
      productId: props.productId,
      designId: props.designId,
      widthMm: width,
      heightMm: height,
      qty,
      // Persist the chamber only when it differs from the design default
      // (omit when equal ⇒ the saved item re-solves byte-identically).
      frameKey: chamberKey && chamberKey !== props.designFrameKey ? chamberKey : undefined,
      cillKey: cillKey || undefined,
      splitRatios: Object.keys(splitRatios).length ? splitRatios : undefined,
    };
    try {
      let orderId = props.orderId;
      if (!orderId) {
        if (!customer.trim()) {
          setAddError("Enter a customer name to start an order.");
          setAdding(false);
          return;
        }
        const order = await createOrder({ customerName: customer.trim() });
        orderId = order.id;
      }
      await addOrderItem(orderId, item);
      router.push(`/orders/${orderId}`);
    } catch (e) {
      setAddError(e instanceof ApiError ? e.message : "Could not add to order");
      setAdding(false);
    }
  }

  const money = (n: number) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: result?.pricing.currency || "GBP",
    }).format(n);

  if (!props.designId) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <EmptyState
          icon="quote"
          title="Start from a quotable design"
          description="Open a product gallery, choose a quotable design, and the configurator will load live dimensions, preview, pricing, and order actions."
          action={
            <ButtonLink href="/products" icon="products">
              Browse products
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const canAdd = Boolean(props.productId);
  const selectedSystem = systems.find((s) => s.systemId === systemId);
  const selectedColour = options?.colours.find((c) => c.key === colourKey);
  const selectedGlass = options?.glass.find((g) => g.key === glassKey);
  const selectedCill = options?.cills?.find((c) => c.key === cillKey);
  const lines = result?.pricing.lines ?? [];
  const previewSvg = result?.geometry.svg || props.designSvg || null;
  const normalizedPreviewSvg = previewSvg ? normalizeSvgForPreview(previewSvg) : null;
  // The editable designer renders the engine SVG (which now carries the cill at
  // the manufacturing height) and aligns its dimension overlay to geometry.outer
  // + geometry.cill, so it works with or without a cill.
  const canUseDesigner = Boolean(result?.geometry.outer && result.geometry.cells?.length);

  // Single source of truth for status, shared by every surface (header meta,
  // preview-card badge, canvas chip). `loading` wins so a re-solve always reads
  // "Updating" even while a stale result is still held; `error` beats `result`.
  const status: Status = loading ? "updating" : error ? "invalid" : result ? "valid" : "idle";

  return (
    <div className="space-y-4">
      <ToastViewport toast={toast} onExpire={expireToast} />
      <PageHeader
        eyebrow="Quote workstation"
        title={props.designName ?? result?.designName ?? "Configure quote"}
        description="Tune manufacturing dimensions and options, inspect the live SVG preview, then review the generated price and material breakdown."
        actions={
          <ButtonLink href="/products" variant="secondary" icon="products">
            Design gallery
          </ButtonLink>
        }
        meta={
          <>
            <Badge tone="purple">{props.designId}</Badge>
            {selectedSystem && <Badge tone="slate">{selectedSystem.name}</Badge>}
            {status !== "idle" && <Badge tone={STATUS_META[status].tone}>{STATUS_META[status].label}</Badge>}
          </>
        }
      />

      <div className="grid min-w-0 gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="h-fit min-w-0 overflow-hidden xl:sticky xl:top-20">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-base font-semibold text-slate-950">Configuration</h2>
            <p className="mt-1 text-sm text-slate-500">Live quote inputs in millimeters.</p>
          </div>
          <div className="space-y-4 p-4">
            <label className="block">
              <FieldLabel>Profile system</FieldLabel>
              <select value={systemId} onChange={(e) => setSystemId(e.target.value)} className={selectClass}>
                {systems.map((s) => (
                  <option key={s.systemId} value={s.systemId}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <FieldLabel>Width</FieldLabel>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    value={width}
                    onChange={(e) => setWidth(parseInt(e.target.value, 10) || 0)}
                    className={fieldClass + " pr-12 font-mono"}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">mm</span>
                </div>
              </label>
              <label className="block">
                <FieldLabel>Height</FieldLabel>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    value={height}
                    onChange={(e) => setHeight(parseInt(e.target.value, 10) || 0)}
                    className={fieldClass + " pr-12 font-mono"}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">mm</span>
                </div>
              </label>
            </div>

            {options?.chambers && options.chambers.length > 0 && (
              <label className="block">
                <FieldLabel>Chamber</FieldLabel>
                <select value={chamberKey} onChange={(e) => setChamberKey(e.target.value)} className={selectClass}>
                  {options.chambers.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="block">
              <FieldLabel>Glass</FieldLabel>
              <select value={glassKey} onChange={(e) => setGlassKey(e.target.value)} className={selectClass}>
                <option value="">Design default</option>
                {options?.glass.map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <FieldLabel>Colour / finish</FieldLabel>
              <select value={colourKey} onChange={(e) => setColourKey(e.target.value)} className={selectClass}>
                {options?.colours.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name}
                    {c.priceUpliftPct ? ` (+${c.priceUpliftPct}%)` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <FieldLabel>Cill</FieldLabel>
              <select value={cillKey} onChange={(e) => setCillKey(e.target.value)} className={selectClass}>
                <option value="">No cill</option>
                {options?.cills?.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name}
                  </option>
                ))}
              </select>
              {cillKey && (
                <p className="mt-1.5 text-xs text-slate-500">
                  Manufacturing height reduced by 30&nbsp;mm; overall size shown stays {height}&nbsp;mm.
                </p>
              )}
            </label>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-600">Glass</span>
                <span className="text-right font-semibold text-slate-950">{selectedGlass?.name ?? "Design default"}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-600">Finish</span>
                <span className="text-right font-semibold text-slate-950">{selectedColour?.name ?? "Default"}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-600">Cill</span>
                <span className="text-right font-semibold text-slate-950">{selectedCill?.name ?? "None"}</span>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {["#ffffff", "#353b3f", "#9a672f", "#4d2b22"].map((color, index) => (
                  <span
                    key={color}
                    className={index === 0 ? "h-8 rounded-md border-2 border-[#4442e3]" : "h-8 rounded-md border border-slate-300"}
                    style={{ background: color }}
                  />
                ))}
              </div>
            </div>
          </div>
        </Card>

        <div className="min-w-0 space-y-5">
          <Card className="min-w-0 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
              <div>
                <h2 className="text-base font-semibold text-slate-950">Live design preview</h2>
                <p className="mt-1 font-mono text-xs text-slate-500">
                  {width} x {height} mm / {systemId || "No system"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="blue">Preview</Badge>
                <Badge tone={STATUS_META[status].tone}>{STATUS_META[status].label}</Badge>
              </div>
            </div>
            <div className="industrial-grid flex min-h-[460px] min-w-0 items-center justify-center overflow-hidden p-3 sm:min-h-[620px] sm:p-5">
              <div className="quote-preview-frame relative flex min-h-0 w-full min-w-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white/[0.84] p-4 shadow-[0_28px_70px_rgba(15,23,42,0.12)] sm:p-6">
                {error ? (
                  <Alert tone="red" title="Quote failed">{error}</Alert>
                ) : canUseDesigner && result ? (
                  <WindowDesigner
                    geometry={result.geometry}
                    widthMm={width}
                    heightMm={height}
                    glassLabel={selectedGlass?.name ?? "Design default"}
                    onWidthChange={setWidth}
                    onHeightChange={setHeight}
                    onSplitRatioChange={(pathId, ratio) =>
                      setSplitRatios((prev) => ({ ...prev, [pathId]: ratio }))
                    }
                  />
                ) : normalizedPreviewSvg ? (
                  <div
                    className="design-preview-svg flex h-full min-h-0 w-full min-w-0 items-center justify-center"
                    dangerouslySetInnerHTML={{ __html: normalizedPreviewSvg }}
                  />
                ) : (
                  <div className="flex w-full max-w-md flex-col items-center">
                    <div className="skeleton h-64 w-full rounded-lg" />
                    <p className="mt-4 text-sm font-semibold text-slate-500">{loading ? "Solving configuration..." : "Enter dimensions to generate preview"}</p>
                  </div>
                )}
                {status !== "idle" && (
                  <div
                    className={
                      "absolute right-4 top-4 z-10 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold  tracking-wide text-white shadow-[0_8px_20px_rgba(15,23,42,0.2)] " +
                      (status === "updating"
                        ? "bg-amber-500"
                        : status === "invalid"
                          ? "bg-red-600"
                          : "bg-emerald-600")
                    }
                  >
                    {status === "updating" ? (
                      <span
                        aria-hidden="true"
                        className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
                      />
                    ) : (
                      <Icon name={status === "invalid" ? "alert" : "check"} className="h-4 w-4" />
                    )}
                    {STATUS_META[status].label}
                  </div>
                )}
              </div>
            </div>
          </Card>

          <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(240px,300px)_minmax(0,1fr)_minmax(280px,340px)]">
            <Card className="min-w-0 overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-4">
                <p className="text-xs font-semibold uppercase text-[#4442e3]">Quote summary</p>
                <div className="mt-2 flex items-baseline justify-between gap-3">
                  <h2 className="text-3xl font-bold text-slate-950">
                    {result ? money(result.pricing.totals.grandTotal) : "--"}
                  </h2>
                  {loading && <span className="text-xs font-semibold uppercase text-amber-600">Updating</span>}
                </div>
              </div>
              <dl className="space-y-3 p-5 text-sm">
                {result ? (
                  <>
                    <SummaryRow label="Material" value={money(result.pricing.totals.materialPrice)} />
                    <SummaryRow label="Labour" value={money(result.pricing.totals.labour)} />
                    <SummaryRow label="Markup" value={money(result.pricing.totals.markup)} />
                    <SummaryRow label="Tax" value={money(result.pricing.totals.tax)} />
                  </>
                ) : (
                  <p className="text-sm text-slate-500">Pricing appears after the first successful quote.</p>
                )}
              </dl>
            </Card>

            <Card className="min-w-0 overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">BOM preview</h2>
                  <p className="mt-1 text-sm text-slate-500">{lines.length} priced lines</p>
                </div>
                <Badge tone="slate">{result?.pricing.currency ?? "GBP"}</Badge>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {lines.length === 0 ? (
                  <p className="p-5 text-sm text-slate-500">Material lines will appear after pricing completes.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {lines.slice(0, 10).map((line) => (
                      <li key={`${line.category}-${line.code}-${line.description}`} className="px-5 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{line.description}</p>
                            <p className="mt-1 font-mono text-xs text-slate-500">{line.code} / {line.qty} {line.unit}</p>
                          </div>
                          <span className="font-semibold text-slate-950">{money(line.totalPrice)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>

            <Card className="min-w-0 p-5 lg:col-span-2 2xl:col-span-1">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">
                    {props.orderId ? "Add to this order" : "Create order from quote"}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    The selected cill is saved with the item; glass and colour use the order defaults.
                  </p>
                </div>
                <Icon name="orders" className="mt-1 h-5 w-5 text-slate-400" />
              </div>
              <div className="mt-4 grid grid-cols-[96px_1fr] gap-3">
                <label>
                  <FieldLabel>Qty</FieldLabel>
                  <input
                    type="number"
                    min={1}
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className={fieldClass}
                  />
                </label>
                {!props.orderId && (
                  <label>
                    <FieldLabel>Customer</FieldLabel>
                    <input
                      value={customer}
                      onChange={(e) => setCustomer(e.target.value)}
                      placeholder="Customer name"
                      className={fieldClass}
                    />
                  </label>
                )}
              </div>
              {!canAdd && (
                <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                  Open the configurator from a product design gallery to enable ordering.
                </p>
              )}
              {addError && <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{addError}</p>}
              <Button onClick={onAddToOrder} disabled={!canAdd || adding} className="mt-4 w-full" icon="plus">
                {adding ? "Adding..." : props.orderId ? "Add item" : "Create order"}
              </Button>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-950">{value}</dd>
    </div>
  );
}
