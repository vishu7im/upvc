"use client";

// =====================================================================
// The Designer workspace (Task 1 phase 3): header + canvas + inspector.
//
// STATE MODEL. Exactly one piece of state matters — the `LineItemDraft` — and
// the reducer below is its ONLY writer. Every control dispatches; nothing keeps
// a shadow copy of an answer. That is what makes "reopen a saved item and see
// the same state" trivially true: the saved draft IS the state.
//
// The resolve is a pure function of that draft, run through the stateless
// public endpoint with a 350 ms debounce (the /quote configurator's proven
// pattern) and stale-response discard. A failed resolve never wipes the canvas:
// the last good result stays on screen behind a banner (ux-design-language §6).
// =====================================================================

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ApiError,
  addDesignerLineItem,
  createOrder,
  resolveLineItem,
  updateDesignerLineItem,
} from "@/lib/api";
import type {
  ComponentRef,
  DraftSelection,
  FamilyResponse,
  LineItemDraft,
  LineItemIssue,
  OptionDef,
  QuoteGeometry,
  ResolvedLineItem,
  SplitMode,
  TopologyEdit,
} from "@/lib/types";
import {
  actionOptionsFor,
  appendEdit,
  appliesToAllOfType,
  clearSelection,
  effectiveAnswer,
  fixForIssue,
  isLocationOption,
  pruneSelections,
  removeEdit,
  setSelection,
  type IssueFix,
} from "@/lib/designer-draft";
import { normalizeSvgForPreview } from "@/lib/svg-preview";
import { downloadPng, downloadSvg, viewFilename } from "@/lib/svg-download";
import DesignerCanvas from "./canvas";
import { Alert, Badge, Button, Card, cn, fieldClass, labelClass } from "@/components/ui";
import { Icon } from "@/components/icons";
import { ToastViewport, type ToastKind, type ToastState } from "@/components/toast";
import OptionsTab from "./options";
import MeasurementsTab from "./measurements";

const Window3D = dynamic(() => import("@/components/window-3d"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[360px] w-full items-center justify-center text-sm text-slate-500">
      Loading 3D view…
    </div>
  ),
});

const RESOLVE_DEBOUNCE_MS = 350;

/** The canvas view switch. "3d" is client-side; the rest are engine renders. */
type DrawnView = "external" | "internal" | "schematic";
type CanvasView = DrawnView | "3d";

const CANVAS_VIEWS: { key: CanvasView; label: string }[] = [
  { key: "external", label: "External" },
  { key: "internal", label: "Internal" },
  { key: "schematic", label: "Schematic" },
  { key: "3d", label: "3D" },
];

// ---------------------------------------------------------------------
// Reducer — the draft's only writer
// ---------------------------------------------------------------------

type Action =
  | { type: "dimension"; key: string; value: number }
  | { type: "choice"; option: OptionDef; choiceKey: string; scope?: string }
  | { type: "value"; option: OptionDef; value: string | number; scope?: string }
  | { type: "reset"; optionKey: string; scope?: string }
  | { type: "splitMode"; mode: SplitMode }
  | { type: "splitRatio"; pathId: string; ratio: number }
  | { type: "quantity"; quantity: number }
  | { type: "addEdit"; edit: TopologyEdit }
  | { type: "removeEdit"; editId: string }
  | { type: "prune"; components: ComponentRef[] };

function draftReducer(draft: LineItemDraft, action: Action): LineItemDraft {
  switch (action.type) {
    case "dimension":
      return { ...draft, dimensions: { ...draft.dimensions, [action.key]: action.value } };

    case "choice": {
      const selection: DraftSelection = {
        optionKey: action.option.key,
        choiceKey: action.choiceKey,
        ...(action.scope ? { scope: action.scope } : {}),
        ...appliedVia(action.option, action.scope),
      };
      return setSelection(draft, selection);
    }

    case "value": {
      if (action.value === "" || (typeof action.value === "number" && Number.isNaN(action.value))) {
        return clearSelection(draft, action.option.key, action.scope);
      }
      return setSelection(draft, {
        optionKey: action.option.key,
        value: action.value,
        ...(action.scope ? { scope: action.scope } : {}),
        ...appliedVia(action.option, action.scope),
      });
    }

    case "reset":
      return clearSelection(draft, action.optionKey, action.scope);

    case "splitMode":
      return { ...draft, splitMode: action.mode };

    case "splitRatio":
      // Positioning a divider is an explicit position, so it also takes the item
      // out of a computed split mode — otherwise the resolver would recompute
      // equal positions and silently discard the drag.
      return {
        ...draft,
        splitMode: "byDimensions",
        splitRatios: { ...(draft.splitRatios ?? {}), [action.pathId]: action.ratio },
      };

    case "quantity":
      return { ...draft, quantity: action.quantity };

    case "addEdit":
      return appendEdit(draft, action.edit);

    case "removeEdit":
      // Removing replays the REMAINING edits in order (the resolver applies the
      // list from the design's own topology), so an undo is exact rather than
      // an inverse operation we would have to invent.
      return removeEdit(draft, action.editId);

    case "prune":
      return pruneSelections(draft, action.components);
  }
}

/**
 * `appliedVia` records which apply-scope the user chose. It has no resolve
 * effect (the scope string is what the server reads); it exists so the UI can
 * show an answer the way it was made. An UNSCOPED answer to a component-level
 * option is the "all of type" intent — the server's rung 3 applies it to every
 * component in scope.
 */
function appliedVia(option: OptionDef, scope?: string) {
  if (!scope) return appliesToAllOfType(option) ? { appliedVia: "all-of-type" as const } : {};
  return scope.endsWith(":*") ? { appliedVia: "all-of-type" as const } : { appliedVia: "this" as const };
}

// ---------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------

export interface WorkspaceProps {
  family: FamilyResponse;
  initialDraft: LineItemDraft;
  designName: string;
  /** Gallery SVG shown until the first resolve lands. */
  fallbackSvg?: string | null;
  orderId?: string;
  /** Present ⇒ editing a persisted designer line item (PUT instead of POST). */
  itemId?: string;
  productId?: string;
}

export default function Workspace({
  family,
  initialDraft,
  designName,
  fallbackSvg,
  orderId,
  itemId,
}: WorkspaceProps) {
  const router = useRouter();
  const { family: descriptor, optionSystem } = family;

  const [draft, dispatch] = useReducer(draftReducer, initialDraft);
  const [resolved, setResolved] = useState<ResolvedLineItem | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const [tab, setTab] = useState<"measurements" | "product">("measurements");
  // The draft's identity for cache freshness: a resolve is a pure function of
  // it, so "same draft ⇒ same drawing" needs no other key.
  const draftKey = useMemo(() => JSON.stringify(draft), [draft]);
  // The selection is ONE piece of state shared by the canvas and the Structure
  // tree — neither owns a copy, so they can never disagree.
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [view, setView] = useState<CanvasView>("external");
  // Which elevation the canvas needs rendered. The 3D tab draws from the solved
  // rects, so it rides on the external render and switching back is instant.
  const drawnView: DrawnView = view === "3d" ? "external" : view;
  // Rendered elevations, keyed by view and stamped with the draft they belong
  // to: a switch back to one already rendered for this draft is free.
  const [viewSvgs, setViewSvgs] = useState<Record<string, { key: string; svg: string }>>({});
  const haveDrawnView = viewSvgs[drawnView]?.key === draftKey;
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [focusOptionKey, setFocusOptionKey] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [customer, setCustomer] = useState("");
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastSeq = useRef(0);
  const settledOnce = useRef(false);
  const showToast = useCallback((kind: ToastKind) => setToast({ id: ++toastSeq.current, kind }), []);
  const expireToast = useCallback(
    (id: number) => setToast((cur) => (cur && cur.id === id ? null : cur)),
    [],
  );

  // ---- live resolve (debounced, stale-discarded) ----------------------
  //
  // The server renders only the elevation being looked at (payloads stay lean),
  // so the view switch is part of what triggers a resolve. Rendered SVGs are
  // cached per view + draft: switching back to a view already rendered for this
  // draft costs nothing, and a switch to a new one skips the debounce because
  // it is a deliberate click, not typing.
  const seq = useRef(0);
  const lastDraftKey = useRef<string | null>(null);
  useEffect(() => {
    // Already rendered for exactly this draft ⇒ nothing to ask for.
    if (haveDrawnView) return;
    const draftChanged = lastDraftKey.current !== draftKey;
    lastDraftKey.current = draftKey;

    const mine = ++seq.current;
    const timer = window.setTimeout(() => {
      setResolving(true);
      if (settledOnce.current) showToast("updating");
      resolveLineItem(draft, drawnView === "external" ? undefined : [drawnView], "realistic")
        .then((r) => {
          if (mine !== seq.current) return; // a newer edit already went out
          setViewSvgs((cur) => {
            const next = { ...cur };
            for (const [key, svg] of Object.entries(r.geometrySvg ?? {})) {
              if (typeof svg === "string") next[key] = { key: draftKey, svg };
            }
            return next;
          });
          setResolved(r);
          setResolveError(null);
          // A structural edit can delete the component an answer was scoped to;
          // dropping those here keeps the item from carrying permanent
          // unknown-component errors. Safe against races: a stale response was
          // already discarded above, so `r` describes the current draft.
          if (r.components?.length) dispatch({ type: "prune", components: r.components });
          if (settledOnce.current) showToast(r.invalidSpec ? "invalid" : "valid");
          settledOnce.current = true;
        })
        .catch((e) => {
          if (mine !== seq.current) return;
          setResolveError(e instanceof ApiError ? e.message : "Could not resolve this configuration");
          showToast("invalid");
        })
        .finally(() => {
          if (mine === seq.current) setResolving(false);
        });
      // A view switch is a deliberate click, not typing: render it at once.
    }, draftChanged ? RESOLVE_DEBOUNCE_MS : 0);
    return () => window.clearTimeout(timer);
  }, [draft, draftKey, drawnView, haveDrawnView, showToast]);

  const issues = useMemo(() => resolved?.issues ?? [], [resolved]);
  const errorCount = issues.filter((i) => i.severity === "error").length;

  // A repair for each issue that HAS one. Pure and derived, so the button set
  // is always consistent with the issues currently on screen.
  const fixes = useMemo(
    () => issues.map((i) => fixForIssue(i, { draft, descriptor, groups: optionSystem.groups })),
    [issues, draft, descriptor, optionSystem],
  );
  // Close the popover on the way out: the list it is showing is about to be
  // recomputed by the next resolve, and leaving stale entries under the cursor
  // invites clicking a fix that has already been applied.
  const applyFix = (fix: IssueFix) => {
    dispatch(fix.action as Action);
    setIssuesOpen(false);
  };

  // ---- component selection --------------------------------------------
  const components = useMemo(() => resolved?.components ?? [], [resolved]);
  /**
   * Component ids are position-derived and therefore stable across re-solves,
   * so a selection normally survives a resize or an option change untouched.
   * When an EDIT does remove the selected component we fall back to its parent
   * and then to item scope — resolved during render, so no effect can leave the
   * inspector pointing at something that no longer exists.
   */
  const selectedComponent = useMemo<ComponentRef | null>(() => {
    if (!selectedComponentId || components.length === 0) return null;
    const exact = components.find((c) => c.componentId === selectedComponentId);
    if (exact) return exact;
    const slash = selectedComponentId.indexOf("/");
    if (slash === -1) return null;
    return components.find((c) => c.componentId === selectedComponentId.slice(0, slash)) ?? null;
  }, [components, selectedComponentId]);

  const componentActions = useMemo(
    () => actionOptionsFor(optionSystem.groups, selectedComponent),
    [optionSystem, selectedComponent],
  );

  /** Run an instant action: append its own edit template, targeted at the selection. */
  const runAction = (option: OptionDef, atRatio?: number) => {
    if (!option.action || !selectedComponent) return;
    const edit = {
      ...option.action,
      componentId: selectedComponent.componentId,
      ...(atRatio !== undefined ? { atRatio } : {}),
    } as TopologyEdit;
    dispatch({ type: "addEdit", edit });
  };

  // A split mode the resolver reports as unimplemented is HIDDEN rather than
  // offered-and-ignored (questions.md Q4 — equalGlass today).
  const unsupportedSplitModes = useMemo(() => {
    const out: string[] = [];
    for (const i of issues) {
      if (i.kind !== "not-implemented") continue;
      for (const m of descriptor.splitModes) {
        if (i.message.includes(`"${m}"`) && !out.includes(m)) out.push(m);
      }
    }
    return out;
  }, [issues, descriptor.splitModes]);
  useEffect(() => {
    if (draft.splitMode && unsupportedSplitModes.includes(draft.splitMode)) {
      dispatch({ type: "splitMode", mode: "byDimensions" });
    }
  }, [unsupportedSplitModes, draft.splitMode]);

  const locationOption = useMemo(
    () => optionSystem.groups.flatMap((g) => g.options).find(isLocationOption),
    [optionSystem],
  );

  // ---- canvas inputs ---------------------------------------------------
  // The drawing for the active view: freshly resolved, else the last one we
  // rendered of THIS view (a stale drawing beats a blank canvas — the same
  // last-good rule the resolve banner follows), else the gallery preview.
  const previewSvg =
    viewSvgs[drawnView]?.svg ??
    (drawnView === "external" ? (resolved?.geometrySvg?.external ?? fallbackSvg ?? null) : null);
  const canvasGeometry: QuoteGeometry | null =
    resolved?.geometry && previewSvg ? { ...resolved.geometry, svg: previewSvg } : null;
  const widthMm = draft.dimensions.widthMm;
  const heightMm = draft.dimensions.heightMm;

  // Colour swatches for the 3D view. Found by ENGINE EFFECT, not by option key:
  // a choice that drives `colour-key` with `params.side` is the finish for that
  // side, whatever the option happens to be called in a given family. The hex
  // itself is catalog data (ColourOption.hex) — the UI never computes a colour.
  const { insideHex, outsideHex } = useMemo(() => {
    const swatch = (side: "inside" | "outside") => {
      for (const g of optionSystem.groups) {
        for (const o of g.options) {
          const choice = effectiveAnswer(draft, o).choice;
          const effect = choice?.engineEffect;
          if (effect?.kind !== "colour-key") continue;
          if ((effect.params?.side ?? "inside") === side) return choice?.swatchHex;
        }
      }
      return undefined;
    };
    const inside = swatch("inside");
    return { insideHex: inside, outsideHex: swatch("outside") ?? inside };
  }, [optionSystem, draft]);

  const money = (n: number) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: resolved?.pricing?.currency || "GBP",
    }).format(n);

  // ---- save ------------------------------------------------------------
  async function onSave() {
    setSaving(true);
    setSaveError(null);
    // `location` is a first-class draft field (documents print it), but the
    // ANSWER lives in the option system — take it from the resolve rather than
    // hardcoding an option key in the UI.
    const toSave: LineItemDraft = {
      ...draft,
      ...(resolved?.summary?.locationLabel ? { location: resolved.summary.locationLabel } : {}),
    };
    try {
      let target = orderId;
      if (!target) {
        if (!customer.trim()) {
          setSaveError("Enter a customer name to start an order.");
          setSaving(false);
          return;
        }
        target = (await createOrder({ customerName: customer.trim() })).id;
      }
      if (itemId && orderId) await updateDesignerLineItem(orderId, itemId, toSave);
      else await addDesignerLineItem(target, toSave);
      router.push(`/orders/${target}`);
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : "Could not save this item");
      setSaving(false);
    }
  }

  const quotable = descriptor.engine.quotable;
  const unitTotal = resolved?.pricing?.totals.grandTotal;

  const inspector = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="tablist" aria-label="Inspector" className="flex border-b border-slate-200">
        {([
          ["measurements", "Measurements"],
          ["product", "Product"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "flex-1 px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.04em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#4442e3]/40",
              tab === key
                ? "border-b-2 border-[#4442e3] text-[#4442e3]"
                : "border-b-2 border-transparent text-slate-500 hover:text-slate-900",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "measurements" ? (
        <MeasurementsTab
          descriptor={descriptor}
          draft={draft}
          issues={issues}
          geometry={resolved?.geometry}
          unsupportedSplitModes={unsupportedSplitModes}
          locationOption={locationOption}
          onDimension={(key, value) => dispatch({ type: "dimension", key, value })}
          onSplitMode={(mode) => dispatch({ type: "splitMode", mode })}
          onSplitRatio={(pathId, ratio) => dispatch({ type: "splitRatio", pathId, ratio })}
          onLocation={(option, value) => dispatch({ type: "value", option, value })}
          onResetLocation={(option) => dispatch({ type: "reset", optionKey: option.key })}
        />
      ) : (
        <OptionsTab
          groups={optionSystem.groups}
          descriptor={descriptor}
          draft={draft}
          issues={issues}
          component={selectedComponent}
          components={components}
          onSelectComponent={setSelectedComponentId}
          actions={componentActions}
          onAction={runAction}
          edits={draft.topologyEdits ?? []}
          onRemoveEdit={(editId) => dispatch({ type: "removeEdit", editId })}
          focusOptionKey={focusOptionKey}
          onChoice={(option, choiceKey, scope) => dispatch({ type: "choice", option, choiceKey, scope })}
          onValue={(option, value, scope) => dispatch({ type: "value", option, value, scope })}
          onReset={(option, scope) => dispatch({ type: "reset", optionKey: option.key, scope })}
        />
      )}

      {/* Action bar. Quantity, the customer (when starting a fresh order) and
          the commit live at the FOOT of the inspector rather than in the
          header: it is where the eye lands after answering the last question,
          and it keeps the header down to identity + price + problems. */}
      <div className="mt-auto space-y-2 border-t border-slate-200 bg-white px-4 py-3">
        {!orderId && (
          <input
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            placeholder="Customer name"
            aria-label="Customer name"
            className={cn(fieldClass, "h-9 text-sm")}
          />
        )}
        <div className="flex items-center gap-2">
          <label className={cn("flex shrink-0 items-center gap-1.5", labelClass)}>
            Qty
            <input
              type="number"
              min={1}
              value={draft.quantity}
              onChange={(e) =>
                dispatch({ type: "quantity", quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })
              }
              className={cn(fieldClass, "h-9 w-14 px-2 font-mono text-sm")}
            />
          </label>
          <Button
            onClick={onSave}
            disabled={!quotable || saving}
            icon="plus"
            className="h-9 min-w-0 flex-1 whitespace-nowrap"
            title={quotable ? undefined : "This family is previewable but not orderable"}
          >
            {saving ? "Saving…" : itemId ? "Update item" : orderId ? "Add to order" : "Create order"}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="-mt-5 space-y-3">
      <ToastViewport toast={toast} onExpire={expireToast} />

      {/* ---- Header ---------------------------------------------------- */}
      <Card className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={orderId ? `/orders/${orderId}` : "/products"}
            className="shrink-0 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Back"
          >
            <Icon name="arrowLeft" className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-950">{designName}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge tone="purple">{descriptor.name}</Badge>
              <Badge tone="slate">
                {Number.isFinite(widthMm) ? widthMm : "—"} × {Number.isFinite(heightMm) ? heightMm : "—"} mm
              </Badge>
              {resolving && <Badge tone="amber">Updating…</Badge>}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="mr-1 text-right">
            {quotable ? (
              <>
                <p className="text-lg font-bold leading-6 text-slate-950">
                  {unitTotal === undefined ? "—" : money(unitTotal)}
                </p>
                <p className={labelClass}>
                  {draft.quantity > 1 && unitTotal !== undefined
                    ? `× ${draft.quantity} = ${money(unitTotal * draft.quantity)}`
                    : "per unit"}
                </p>
              </>
            ) : (
              <Badge tone="amber">Preview only</Badge>
            )}
          </div>

          <IssuesButton
            issues={issues}
            fixes={fixes}
            onFix={applyFix}
            open={issuesOpen}
            onToggle={() => setIssuesOpen((v) => !v)}
            onFocus={(issue) => {
              setIssuesOpen(false);
              // Scope first: an issue about a component selects it, so the
              // option the issue names is shown for the right part.
              if (issue.scope && components.some((c) => c.componentId === issue.scope)) {
                setSelectedComponentId(issue.scope);
              }
              if (issue.dimensionKey) setTab("measurements");
              else {
                setTab("product");
                if (issue.optionKey) {
                  setFocusOptionKey(null);
                  window.setTimeout(() => setFocusOptionKey(issue.optionKey ?? null), 0);
                }
              }
            }}
          />

          <button
            type="button"
            onClick={() => setInspectorOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 lg:hidden"
          >
            <Icon name="settings" className="h-4 w-4" />
            Edit
          </button>
        </div>
      </Card>

      {saveError && <Alert tone="red" title="Could not save">{saveError}</Alert>}
      {errorCount > 0 && (
        <Alert tone="amber" title={`${errorCount} ${errorCount === 1 ? "problem" : "problems"} to fix before ordering`}>
          Drafts save with problems; the order confirm step is the gate.
        </Alert>
      )}

      {/* ---- Workspace -------------------------------------------------- */}
      <div className="grid min-w-0 gap-3 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="hidden min-h-0 lg:sticky lg:top-16 lg:flex lg:max-h-[calc(100vh-108px)] lg:flex-col lg:overflow-hidden">
          {inspector}
        </Card>

        {inspectorOpen && (
          <div className="fixed inset-0 z-40 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Inspector">
            <div className="absolute inset-0 bg-slate-900/40" onClick={() => setInspectorOpen(false)} />
            <div className="relative flex h-full w-[min(24rem,88vw)] flex-col bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                <span className="text-sm font-semibold text-slate-950">Configure</span>
                <button
                  type="button"
                  onClick={() => setInspectorOpen(false)}
                  className="rounded p-1 text-slate-500 hover:bg-slate-100"
                  aria-label="Close inspector"
                >
                  <Icon name="x" className="h-4 w-4" />
                </button>
              </div>
              {inspector}
            </div>
          </div>
        )}

        <Card className="min-w-0 overflow-hidden">
          <div className="industrial-grid relative flex min-h-[560px] min-w-0 items-center justify-center overflow-hidden p-2 sm:min-h-[680px] lg:min-h-[calc(100vh-186px)]">
            <div className="pointer-events-none absolute right-3 top-3 z-20 flex flex-wrap items-center justify-end gap-2">
              <div
                role="tablist"
                aria-label="View"
                className="pointer-events-auto inline-flex overflow-hidden rounded-md border border-slate-300 bg-white/90 text-xs font-semibold shadow-[0_10px_28px_rgba(15,23,42,0.12)] backdrop-blur"
              >
                {CANVAS_VIEWS.map((v) => (
                  <button
                    key={v.key}
                    role="tab"
                    type="button"
                    aria-selected={view === v.key}
                    onClick={() => setView(v.key)}
                    className={cn(
                      "px-3 py-1.5 transition-colors",
                      view === v.key ? "bg-[#4442e3] text-white" : "text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    {v.label}
                  </button>
                ))}
              </div>

              {view !== "3d" && previewSvg && (
                <div className="pointer-events-auto inline-flex overflow-hidden rounded-md border border-slate-300 bg-white/90 text-xs font-semibold shadow-[0_10px_28px_rgba(15,23,42,0.12)] backdrop-blur">
                  <span className="flex items-center pl-2 text-slate-400" aria-hidden="true">
                    <Icon name="download" className="h-3.5 w-3.5" />
                  </span>
                  {(["svg", "png"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => {
                        const name = viewFilename(designName, widthMm, heightMm, drawnView);
                        if (fmt === "svg") downloadSvg(previewSvg, name);
                        else void downloadPng(previewSvg, name).catch(() => showToast("invalid"));
                      }}
                      className="px-2 py-1.5 uppercase text-slate-600 transition-colors hover:bg-slate-50"
                      title={`Download this view as ${fmt.toUpperCase()}`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {resolveError && (
              <div className="pointer-events-none absolute inset-x-3 top-3 z-10">
                <Alert tone="red" title="Preview not updated">{resolveError}</Alert>
              </div>
            )}

            {view === "3d" && canvasGeometry ? (
              <Window3D geometry={canvasGeometry} insideHex={insideHex} outsideHex={outsideHex} />
            ) : canvasGeometry ? (
              <DesignerCanvas
                geometry={canvasGeometry}
                widthMm={widthMm}
                heightMm={heightMm}
                glassLabel={resolved?.summary?.colourLabel ?? descriptor.name}
                components={components}
                selectedComponentId={selectedComponent?.componentId ?? null}
                onSelectComponent={setSelectedComponentId}
                onWidthChange={(v) => dispatch({ type: "dimension", key: "widthMm", value: v })}
                onHeightChange={(v) => dispatch({ type: "dimension", key: "heightMm", value: v })}
                onSplitRatioChange={(pathId, ratio) => dispatch({ type: "splitRatio", pathId, ratio })}
                mirrored={drawnView === "internal"}
              />
            ) : previewSvg ? (
              <div
                className="design-preview-svg flex h-full min-h-0 w-full min-w-0 items-center justify-center"
                dangerouslySetInnerHTML={{ __html: normalizeSvgForPreview(previewSvg) }}
              />
            ) : (
              <div className="flex w-full max-w-md flex-col items-center">
                <div className="skeleton h-64 w-full rounded-lg" />
                <p className="mt-4 text-sm font-semibold text-slate-500">
                  {resolving
                    ? drawnView === "external"
                      ? "Solving configuration…"
                      : `Rendering the ${drawnView} view…`
                    : "Enter dimensions to generate a preview"}
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Issues
// ---------------------------------------------------------------------

function IssuesButton({
  issues,
  fixes,
  onFix,
  open,
  onToggle,
  onFocus,
}: {
  issues: LineItemIssue[];
  /** Same length/order as `issues`; null where there is no honest repair. */
  fixes: (IssueFix | null)[];
  onFix: (fix: IssueFix) => void;
  open: boolean;
  onToggle: () => void;
  onFocus: (issue: LineItemIssue) => void;
}) {
  const errors = issues.filter((i) => i.severity === "error").length;
  const fixable = fixes.filter((f): f is IssueFix => f !== null);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[#4442e3]/25",
          errors > 0
            ? "border-red-200 bg-red-50 text-red-700"
            : issues.length > 0
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-slate-200 bg-white text-slate-600",
        )}
      >
        <Icon name={issues.length ? "alert" : "check"} className="h-4 w-4" />
        Issues ({issues.length})
        {fixable.length > 0 && (
          <span className="rounded-full bg-white/70 px-1.5 text-[10px] font-bold text-slate-700">
            {fixable.length} fixable
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-1 w-[min(28rem,90vw)] rounded-xl border border-slate-200 bg-white p-2 text-left shadow-[var(--shadow-lg)]">
          {fixable.length > 1 && (
            <button
              type="button"
              onClick={() => fixable.forEach(onFix)}
              className="mb-1 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#4442e3] px-2 py-1.5 text-xs font-semibold text-white transition hover:bg-[#3634c0]"
            >
              <Icon name="check" className="h-3.5 w-3.5" />
              Fix {fixable.length} automatically
            </button>
          )}
          <ul aria-live="polite" className="max-h-80 space-y-1 overflow-y-auto">
            {issues.length === 0 && (
              <li className="px-2 py-3 text-xs text-slate-500">
                No issues — this configuration is fabricable.
              </li>
            )}
            {issues.map((issue, i) => {
              const fix = fixes[i];
              return (
                <li key={i} className="rounded-lg px-2 py-1.5 transition hover:bg-slate-50">
                  <span
                    className={cn(
                      "mr-1.5 rounded px-1 text-[10px] font-bold uppercase",
                      issue.severity === "error" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800",
                    )}
                  >
                    {issue.severity}
                  </span>
                  <span className="text-xs font-medium text-slate-800">{issue.message}</span>
                  {issue.source && (
                    <span className="mt-0.5 block text-[10px] font-medium text-slate-400">{issue.source}</span>
                  )}
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {fix ? (
                      <button
                        type="button"
                        onClick={() => onFix(fix)}
                        className="rounded-md bg-[#4442e3] px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-[#3634c0] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4442e3]/40"
                      >
                        {fix.label}
                      </button>
                    ) : (
                      // No auto-fix: the fabrication constraints (HAWDIO size /
                      // weight maxima) and genuine ambiguities are decisions,
                      // not typos — say so rather than offering a false button.
                      <span className="text-[10px] font-medium text-slate-400">Needs a decision</span>
                    )}
                    <button
                      type="button"
                      onClick={() => onFocus(issue)}
                      className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4442e3]/40"
                    >
                      Show me
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
