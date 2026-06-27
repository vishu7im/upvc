"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, quote, createOrder, addOrderItem, ApiError } from "@/lib/api";
import type { QuoteResult, SystemOptions, SystemSummary } from "@/lib/types";
import { normalizeSvgForPreview } from "@/lib/svg-preview";
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

export interface ConfiguratorProps {
  designId?: string;
  productId?: string;
  designName?: string;
  systemId?: string;
  orderId?: string;
  designSvg?: string | null;
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

  const [result, setResult] = useState<QuoteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      })
      .catch(() => setOptions(null));
  }, [systemId]);

  const runQuote = useCallback(() => {
    if (!props.designId || !systemId || width <= 0 || height <= 0) return;
    setLoading(true);
    setError(null);
    quote({
      systemId,
      designId: props.designId,
      widthMm: width,
      heightMm: height,
      glassKey: glassKey || undefined,
      colourKey: colourKey || undefined,
    })
      .then((r) => setResult(r))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Quote failed"))
      .finally(() => setLoading(false));
  }, [props.designId, systemId, width, height, glassKey, colourKey]);

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
  const lines = result?.pricing.lines ?? [];
  const previewSvg = props.designSvg || result?.geometry.svg || null;
  const normalizedPreviewSvg = previewSvg ? normalizeSvgForPreview(previewSvg) : null;

  return (
    <div className="space-y-5">
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
            {loading ? <Badge tone="amber">Updating</Badge> : result ? <Badge tone="green">Valid configuration</Badge> : null}
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(420px,1fr)_380px]">
        <Card className="h-fit overflow-hidden xl:sticky xl:top-20">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-950">Configuration</h2>
            <p className="mt-1 text-sm text-slate-500">Live quote inputs in millimeters.</p>
          </div>
          <div className="space-y-5 p-5">
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

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-600">Glass</span>
                <span className="text-right font-semibold text-slate-950">{selectedGlass?.name ?? "Design default"}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-600">Finish</span>
                <span className="text-right font-semibold text-slate-950">{selectedColour?.name ?? "Default"}</span>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {["#ffffff", "#353b3f", "#9a672f", "#4d2b22"].map((color, index) => (
                  <span
                    key={color}
                    className={index === 0 ? "h-10 rounded-md border-2 border-[#4442e3]" : "h-10 rounded-md border border-slate-300"}
                    style={{ background: color }}
                  />
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Live design preview</h2>
              <p className="mt-1 font-mono text-xs text-slate-500">
                {width} x {height} mm / {systemId || "No system"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="blue">Preview</Badge>
              <Badge tone={error ? "red" : result ? "green" : "slate"}>{error ? "Issue" : result ? "Solved" : "Waiting"}</Badge>
            </div>
          </div>
          <div className="industrial-grid flex min-h-[560px] items-center justify-center p-6">
            <div className="relative flex min-h-[460px] w-full max-w-3xl items-center justify-center rounded-lg border border-slate-200 bg-white/[0.84] p-8 shadow-[0_28px_70px_rgba(15,23,42,0.12)]">
              {error ? (
                <Alert tone="red" title="Quote failed">{error}</Alert>
              ) : normalizedPreviewSvg ? (
                <div
                  className="design-preview-svg flex h-full max-h-[620px] min-h-[360px] w-full items-center justify-center"
                  dangerouslySetInnerHTML={{ __html: normalizedPreviewSvg }}
                />
              ) : (
                <div className="flex w-full max-w-md flex-col items-center">
                  <div className="skeleton h-64 w-full rounded-lg" />
                  <p className="mt-4 text-sm font-semibold text-slate-500">{loading ? "Solving configuration..." : "Enter dimensions to generate preview"}</p>
                </div>
              )}
              {result && (
                <div className="absolute right-4 top-4 rounded-md bg-emerald-600 px-3 py-2 text-xs font-bold uppercase text-white shadow-[0_10px_25px_rgba(16,185,129,0.25)]">
                  Valid configuration
                </div>
              )}
            </div>
          </div>
        </Card>

        <div className="space-y-5 xl:sticky xl:top-20 xl:h-fit">
          <Card className="overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4">
              <p className="text-xs font-semibold uppercase text-[#4442e3]">Quote summary</p>
              <div className="mt-2 flex items-baseline justify-between gap-3">
                <h2 className="text-4xl font-bold text-slate-950">
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

          <Card className="overflow-hidden">
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

          <Card className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-950">
                  {props.orderId ? "Add to this order" : "Create order from quote"}
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Saved items use default glass and colour in the current order API.
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
