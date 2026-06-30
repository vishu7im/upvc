"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { apiGet, quote, createOrder, addOrderItem, ApiError } from "@/lib/api";
import type { QuoteResult, SystemOptions, SystemSummary } from "@/lib/types";
import { normalizeSvgForPreview } from "@/lib/svg-preview";
import WindowDesigner from "@/components/window-designer";

// 3D massing view: lazy + client-only (three.js never enters the server bundle
// and the heavy chunk loads only when the user opens the 3D tab).
const Window3D = dynamic(() => import("@/components/window-3d"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[360px] w-full items-center justify-center text-sm text-slate-500">
      Loading 3D view…
    </div>
  ),
});
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  FieldLabel,
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
  /** The design's default manufacturing size (mm); preloads Width/Height. */
  defaultWidthMm?: number | null;
  defaultHeightMm?: number | null;
}

// Fallback when a design carries no stored default dimensions.
const FALLBACK_WIDTH_MM = 1200;
const FALLBACK_HEIGHT_MM = 1200;

export default function Configurator(props: ConfiguratorProps) {
  const router = useRouter();

  const [systems, setSystems] = useState<SystemSummary[]>([]);
  const [systemId, setSystemId] = useState(props.systemId ?? "");
  const [options, setOptions] = useState<SystemOptions | null>(null);

  // Preload the design's stored default dimensions (page remounts per design via
  // `key`, so these initial values are correct for each design).
  const [width, setWidth] = useState(props.defaultWidthMm ?? FALLBACK_WIDTH_MM);
  const [height, setHeight] = useState(props.defaultHeightMm ?? FALLBACK_HEIGHT_MM);
  const [glassKey, setGlassKey] = useState("");
  const [colourKey, setColourKey] = useState("");
  // Outside colour for a dual-colour finish. "" ⇒ same as inside (single colour).
  const [colourKeyOutside, setColourKeyOutside] = useState("");
  // Inner-joint overlay toggle + 2D/3D preview switch (purely visual).
  const [showJoints, setShowJoints] = useState(false);
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
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
        setColourKeyOutside("");
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
      colourKeyOutside: colourKeyOutside || undefined,
      cillKey: cillKey || undefined,
      splitRatios: Object.keys(splitRatios).length ? splitRatios : undefined,
      showJoints: showJoints || undefined,
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
  }, [props.designId, systemId, width, height, chamberKey, glassKey, colourKey, colourKeyOutside, cillKey, splitRatios, showJoints, showToast]);

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
      // Persist colour only when a non-default finish is chosen (omit when it
      // equals the system default ⇒ the saved item re-solves byte-identically).
      colourKeyInside:
        colourKey && colourKey !== options?.defaultColourKey ? colourKey : undefined,
      colourKeyOutside:
        colourKeyOutside && colourKeyOutside !== colourKey ? colourKeyOutside : undefined,
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
  const selectedColourOutside = options?.colours.find((c) => c.key === colourKeyOutside);
  const isDualColour = Boolean(colourKeyOutside && colourKeyOutside !== colourKey);
  const finishLabel = isDualColour
    ? `${selectedColour?.name ?? "Default"} / ${selectedColourOutside?.name ?? ""} (out)`
    : selectedColour?.name ?? "Default";
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
    <div className="-mt-5 space-y-2">
      <ToastViewport toast={toast} onExpire={expireToast} />
      <div className="grid min-w-0 gap-4 xl:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)]">
        <Card className="h-fit min-w-0 overflow-hidden xl:sticky xl:top-16">
          <div className="border-b border-slate-200 px-3 py-2.5">
            <h2 className="text-base font-semibold text-slate-950">Configuration</h2>
          </div>
          <div className="space-y-3 p-3">
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

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <FieldLabel>Colour — inside</FieldLabel>
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
                <FieldLabel>Colour — outside</FieldLabel>
                <select value={colourKeyOutside} onChange={(e) => setColourKeyOutside(e.target.value)} className={selectClass}>
                  <option value="">Same as inside</option>
                  {options?.colours.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.name}
                      {c.priceUpliftPct ? ` (+${c.priceUpliftPct}%)` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>

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

            <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-600">Glass</span>
                <span className="text-right font-semibold text-slate-950">{selectedGlass?.name ?? "Design default"}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-600">Finish</span>
                <span className="text-right font-semibold text-slate-950">{finishLabel}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-600">Cill</span>
                <span className="text-right font-semibold text-slate-950">{selectedCill?.name ?? "None"}</span>
              </div>
              {/* Live swatches: inside / outside finish (falls back to grey when a
                  colour carries no display hex). */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-500">Inside</p>
                  <span
                    className="block h-8 rounded-md border border-slate-300"
                    style={{ background: selectedColour?.hex ?? "#e6e6e6" }}
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-500">Outside</p>
                  <span
                    className="block h-8 rounded-md border border-slate-300"
                    style={{ background: (isDualColour ? selectedColourOutside?.hex : selectedColour?.hex) ?? "#e6e6e6" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="min-w-0 space-y-4">
          <Card className="min-w-0 overflow-hidden">
            <div className="industrial-grid flex min-h-[560px] min-w-0 items-center justify-center overflow-hidden p-2 sm:min-h-[720px] xl:min-h-[calc(100vh-104px)]">
              <div className="quote-preview-frame relative flex min-h-0 w-full min-w-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white/[0.84] p-3 shadow-[0_28px_70px_rgba(15,23,42,0.12)] sm:p-4">
                <div className="pointer-events-none absolute left-3 right-3 top-3 z-20 flex flex-wrap items-start justify-between gap-2">
                  <div className="max-w-[min(560px,calc(100%-220px))] rounded-md border border-white/70 bg-white/85 px-3 py-2 shadow-[0_10px_28px_rgba(15,23,42,0.12)] backdrop-blur">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="max-w-[360px] truncate text-sm font-bold text-slate-950">
                        {props.designName ?? result?.designName ?? "Configure quote"}
                      </p>
                      <Badge tone="purple" className="bg-white/80">{props.designId}</Badge>
                      {selectedSystem && <Badge tone="slate" className="bg-white/80">{selectedSystem.name}</Badge>}
                    </div>
                    <p className="mt-1 font-mono text-xs font-semibold text-slate-500">
                      {width} x {height} mm / {systemId || "No system"}
                    </p>
                  </div>

                  <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
                    <div className="inline-flex overflow-hidden rounded-md border border-slate-300 bg-white/90 text-xs font-semibold shadow-[0_10px_28px_rgba(15,23,42,0.12)] backdrop-blur">
                      {(["2d", "3d"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setViewMode(m)}
                          className={
                            "px-3 py-1.5 transition-colors " +
                            (viewMode === m ? "bg-[#4442e3] text-white" : "text-slate-600 hover:bg-slate-50")
                          }
                          aria-pressed={viewMode === m}
                        >
                          {m === "2d" ? "2D" : "3D"}
                        </button>
                      ))}
                    </div>
                    <label
                      className={
                        "inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white/90 px-3 py-1.5 text-xs font-semibold shadow-[0_10px_28px_rgba(15,23,42,0.12)] backdrop-blur " +
                        (viewMode === "3d" ? "cursor-not-allowed text-slate-300" : "cursor-pointer text-slate-600 hover:bg-slate-50")
                      }
                    >
                      <input
                        type="checkbox"
                        checked={showJoints}
                        disabled={viewMode === "3d"}
                        onChange={(e) => setShowJoints(e.target.checked)}
                        className="h-3.5 w-3.5"
                      />
                      Joints
                    </label>
                    <ButtonLink href="/products" variant="secondary" icon="products" className="h-8 bg-white/90 px-2.5 text-xs shadow-[0_10px_28px_rgba(15,23,42,0.12)] backdrop-blur">
                      Gallery
                    </ButtonLink>
                  </div>
                </div>
                {error ? (
                  <Alert tone="red" title="Quote failed">{error}</Alert>
                ) : viewMode === "3d" && canUseDesigner && result ? (
                  <Window3D
                    geometry={result.geometry}
                    insideHex={selectedColour?.hex}
                    outsideHex={(isDualColour ? selectedColourOutside?.hex : selectedColour?.hex)}
                  />
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
                      "absolute bottom-4 right-4 z-10 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold  tracking-wide text-white shadow-[0_8px_20px_rgba(15,23,42,0.2)] " +
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
                    The selected cill and colour (inside/outside) are saved with the item; glass uses the order default.
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
