"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import WindowDesigner from "@/components/window-designer";
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  Cluster,
  Drawer,
  Grid,
  PageHeading,
  Section,
  Stack,
  StatusChip,
  TextField,
  useToast,
} from "@/components/v2";
import {
  addDesignerLineItem,
  apiGet,
  apiSend,
  ApiError,
  createOrder,
  quote,
  resolveLineItem,
  updateDesignerLineItem,
} from "@/lib/api";
import {
  appendEdit,
  appliesToAllOfType,
  clearSelection,
  effectiveAnswer,
  fixForIssue,
  isAdvisoryIssue,
  pruneSelections,
  removeEdit,
  setSelection,
  withChosenPart,
  type IssueFix,
} from "@/lib/designer-draft";
import { money } from "@/lib/format";
import { downloadPng, downloadSvg, viewFilename } from "@/lib/svg-download";
import { normalizeSvgForPreview } from "@/lib/svg-preview";
import type {
  ComponentRef,
  DesignDetail,
  DraftSelection,
  FamilyResponse,
  LineItemDraft,
  LineItemIssue,
  OptionDef,
  OrderDetail,
  QuoteGeometry,
  ResolvedLineItem,
  SplitMode,
  TopologyEdit,
} from "@/lib/types";
import {
  CONFIGURE_DEBOUNCE_MS,
  configureHref,
  isStandardDraftCompatible,
  standardOrderItemInput,
  standardPreviewRequest,
  type ConfigureMode,
} from "@/lib/v2/configure";
import { CommercialsForm } from "../../orders/_components/commercials-form";
import { ConfigureInspector } from "./configure-inspector";

const Window3D = dynamic(() => import("@/components/window-3d"), {
  ssr: false,
  loading: () => <p className="v2-configure-muted">Loading 3D view…</p>,
});

type DrawnView = "external" | "internal" | "schematic";
type CanvasView = DrawnView | "3d";

const CUSTOM_VIEWS: ReadonlyArray<{ key: CanvasView; label: string }> = [
  { key: "external", label: "External" },
  { key: "internal", label: "Internal" },
  { key: "schematic", label: "Schematic" },
  { key: "3d", label: "3D" },
];

type Action =
  | { type: "system"; systemId: string }
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

function appliedVia(option: OptionDef, scope?: string) {
  if (!scope) return appliesToAllOfType(option) ? { appliedVia: "all-of-type" as const } : {};
  return scope.endsWith(":*")
    ? { appliedVia: "all-of-type" as const }
    : { appliedVia: "this" as const };
}

function draftReducer(draft: LineItemDraft, action: Action): LineItemDraft {
  switch (action.type) {
    case "system":
      return { ...draft, systemId: action.systemId };
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
    case "value":
      if (action.value === "" || (typeof action.value === "number" && Number.isNaN(action.value))) {
        return clearSelection(draft, action.option.key, action.scope);
      }
      return setSelection(draft, {
        optionKey: action.option.key,
        value: action.value,
        ...(action.scope ? { scope: action.scope } : {}),
        ...appliedVia(action.option, action.scope),
      });
    case "reset":
      return clearSelection(draft, action.optionKey, action.scope);
    case "splitMode":
      return { ...draft, splitMode: action.mode };
    case "splitRatio":
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
      return removeEdit(draft, action.editId);
    case "prune":
      return pruneSelections(draft, action.components);
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export default function ConfigureWorkspace({
  canPersist,
  design,
  family,
  importIssues,
  initialDraft,
  itemId,
  mode,
  order,
  productId,
  replacesItemId,
}: {
  canPersist: boolean;
  design: DesignDetail;
  family: FamilyResponse;
  importIssues: LineItemIssue[];
  initialDraft: LineItemDraft;
  itemId?: string;
  mode: ConfigureMode;
  order: OrderDetail | null;
  productId?: string | null;
  replacesItemId?: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [activeMode, setActiveMode] = useState<ConfigureMode>(mode);
  const [modeSeed, setModeSeed] = useState(mode);
  if (modeSeed !== mode) {
    setModeSeed(mode);
    setActiveMode(mode);
  }
  const [draft, dispatch] = useReducer(draftReducer, initialDraft);
  const [resolved, setResolved] = useState<ResolvedLineItem | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [view, setView] = useState<CanvasView>("external");
  const [showJoints, setShowJoints] = useState(false);
  const [viewSvgs, setViewSvgs] = useState<Record<string, { key: string; svg: string }>>({});
  const [jointSvg, setJointSvg] = useState<{ key: string; svg: string } | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [customer, setCustomer] = useState(order?.customerName ?? "");
  const [targetOrderId, setTargetOrderId] = useState(order?.id);
  const [targetItemId, setTargetItemId] = useState(itemId);
  const [targetReplaceId, setTargetReplaceId] = useState(replacesItemId);
  const [committedLegacy, setCommittedLegacy] = useState(false);
  const [savingAction, setSavingAction] = useState<"return" | "price" | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [priceOrder, setPriceOrder] = useState<OrderDetail | null>(null);
  const priceRef = useRef<HTMLDivElement>(null);
  const sequence = useRef(0);
  const settledOnceRef = useRef(false);
  const lastDraftKey = useRef<string | null>(null);

  const draftKey = useMemo(() => JSON.stringify(draft), [draft]);
  const drawnView: DrawnView = view === "3d" ? "external" : view;
  const standardCompatible = isStandardDraftCompatible(draft, family.optionSystem.groups);
  const needsJointPreview = activeMode === "standard" && showJoints && view !== "3d" && standardCompatible;
  const drawnIdentity = `${draftKey}:${drawnView}:${needsJointPreview ? "joints" : "plain"}`;
  const haveDrawnView = needsJointPreview
    ? jointSvg?.key === drawnIdentity
    : viewSvgs[drawnView]?.key === draftKey;

  useEffect(() => {
    if (haveDrawnView) return;
    const draftChanged = lastDraftKey.current !== draftKey;
    lastDraftKey.current = draftKey;
    const mine = ++sequence.current;
    const timer = window.setTimeout(async () => {
      setResolving(true);
      if (settledOnceRef.current) {
        showToast({ tone: "neutral", title: "Updating preview" });
      }

      const jointRequest = needsJointPreview
        ? quote({
          ...standardPreviewRequest(draft, family.optionSystem.groups),
          showJoints: true,
          svgStyle: "realistic",
        })
          .then((result) => ({ result, error: null }))
          .catch((error: unknown) => ({ result: null, error }))
        : null;

      try {
        const next = await resolveLineItem(
          draft,
          drawnView === "external" ? undefined : [drawnView],
          "realistic",
        );
        if (mine !== sequence.current) return;

        setViewSvgs((current) => {
          const updated = { ...current };
          for (const [key, svg] of Object.entries(next.geometrySvg ?? {})) {
            if (typeof svg === "string") updated[key] = { key: draftKey, svg };
          }
          return updated;
        });
        setResolved(next);
        setResolveError(null);
        if (next.components?.length) dispatch({ type: "prune", components: next.components });

        if (jointRequest) {
          const jointOutcome = await jointRequest;
          if (mine === sequence.current && jointOutcome.result) {
            setJointSvg({ key: drawnIdentity, svg: jointOutcome.result.geometry.svg });
          } else if (mine === sequence.current && jointOutcome.error) {
            setResolveError(`Joint overlay not updated. ${errorMessage(jointOutcome.error, "The last good preview remains visible.")}`);
          }
        }

        if (settledOnceRef.current) {
          showToast({
            tone: next.blocking ? "error" : "success",
            title: next.blocking ? "Configuration needs attention" : "Preview updated",
          });
        }
        settledOnceRef.current = true;
      } catch (error) {
        if (mine !== sequence.current) return;
        setResolveError(errorMessage(error, "Could not resolve this configuration. The last good preview remains visible."));
        showToast({ tone: "error", title: "Preview not updated", description: errorMessage(error, "Keep editing or retry.") });
      } finally {
        if (mine === sequence.current) setResolving(false);
      }
    }, draftChanged ? CONFIGURE_DEBOUNCE_MS : 0);
    return () => window.clearTimeout(timer);
  }, [draft, draftKey, drawnIdentity, drawnView, family.optionSystem.groups, haveDrawnView, needsJointPreview, showToast]);

  const issues = useMemo(() => resolved?.issues ?? [], [resolved]);
  const fixes = useMemo(
    () => issues.map((issue) => fixForIssue(issue, {
      draft,
      descriptor: family.family,
      groups: family.optionSystem.groups,
    })),
    [draft, family, issues],
  );
  const components = useMemo(() => resolved?.components ?? [], [resolved]);
  const selectedComponent = useMemo<ComponentRef | null>(() => {
    if (!selectedComponentId) return null;
    const exact = components.find((component) => component.componentId === selectedComponentId);
    if (exact) return exact;
    const slash = selectedComponentId.indexOf("/");
    return slash === -1
      ? null
      : components.find((component) => component.componentId === selectedComponentId.slice(0, slash)) ?? null;
  }, [components, selectedComponentId]);

  function applyFix(fix: IssueFix) {
    dispatch(fix.action as Action);
    setIssuesOpen(false);
  }

  function runAction(option: OptionDef, atRatio?: number, choiceKey?: string) {
    if (!option.action || !selectedComponent) return;
    const base = {
      ...option.action,
      componentId: selectedComponent.componentId,
      ...(atRatio !== undefined ? { atRatio } : {}),
    } as TopologyEdit;
    const partKey = choiceKey
      ? option.choices.find((choice) => choice.key === choiceKey)?.partKey
      : undefined;
    dispatch({ type: "addEdit", edit: withChosenPart(base, partKey) });
  }

  useEffect(() => {
    const unsupported = issues
      .filter((issue) => issue.kind === "not-implemented")
      .some((issue) => draft.splitMode && issue.message.includes(`"${draft.splitMode}"`));
    if (unsupported) dispatch({ type: "splitMode", mode: "byDimensions" });
  }, [draft.splitMode, issues]);

  const previewSvg = needsJointPreview && jointSvg?.key === drawnIdentity
    ? jointSvg.svg
    : viewSvgs[drawnView]?.svg
      ?? (drawnView === "external" ? resolved?.geometrySvg?.external ?? design.imageSvg : null);
  const normalizedFallback = previewSvg ? normalizeSvgForPreview(previewSvg) : null;
  const canvasGeometry: QuoteGeometry | null = resolved?.geometry && previewSvg
    ? { ...resolved.geometry, svg: previewSvg }
    : null;

  const { insideHex, outsideHex } = useMemo(() => {
    const swatch = (side: "inside" | "outside") => {
      for (const group of family.optionSystem.groups) {
        for (const option of group.options) {
          const choice = effectiveAnswer(draft, option).choice;
          const effect = choice?.engineEffect;
          if (effect?.kind !== "colour-key") continue;
          if ((effect.params?.side ?? "inside") === side) return choice?.swatchHex;
        }
      }
      return undefined;
    };
    const inside = swatch("inside");
    return { insideHex: inside, outsideHex: swatch("outside") ?? inside };
  }, [draft, family.optionSystem.groups]);

  // Configuration remains a useful local what-if workspace for read-only users.
  // Persistence permissions are enforced only by the order actions below.
  const configurationEditable = !committedLegacy;
  const standardCanSave = activeMode === "custom" || (Boolean(productId) && standardCompatible);

  async function persist(): Promise<{ orderId: string; itemId?: string }> {
    if (committedLegacy && targetOrderId) return { orderId: targetOrderId };
    if (!canPersist) throw new Error("You do not have permission to change order items.");
    if (!family.family.engine.quotable) throw new Error("This family is preview-only and cannot be ordered.");

    let orderId = targetOrderId;
    if (!orderId) {
      if (!customer.trim()) throw new Error("Enter a customer name to start an order.");
      orderId = (await createOrder({ customerName: customer.trim() })).id;
      setTargetOrderId(orderId);
    }

    if (activeMode === "standard") {
      if (!productId) throw new Error("This layout has no product context for a Standard order item.");
      const item = await apiSend<{ id: string }>(
        `/api/orders/${encodeURIComponent(orderId)}/items`,
        "POST",
        standardOrderItemInput(draft, family.optionSystem.groups, productId),
      );
      setCommittedLegacy(true);
      return { orderId, itemId: item.id };
    }

    const toSave: LineItemDraft = {
      ...draft,
      ...(resolved?.summary?.locationLabel ? { location: resolved.summary.locationLabel } : {}),
    };
    if (targetItemId) {
      await updateDesignerLineItem(orderId, targetItemId, toSave);
      return { orderId, itemId: targetItemId };
    }

    const item = await addDesignerLineItem(orderId, toSave, targetReplaceId);
    setTargetItemId(item.id);
    setTargetReplaceId(undefined);
    return { orderId, itemId: item.id };
  }

  async function saveAndReturn() {
    setSavingAction("return");
    setSaveError(null);
    try {
      const target = await persist();
      showToast({ tone: "success", title: committedLegacy ? "Item already saved" : "Item saved" });
      router.push(`/v2/orders/${encodeURIComponent(target.orderId)}/items`);
      router.refresh();
    } catch (error) {
      setSaveError(errorMessage(error, "Could not save this item."));
      setSavingAction(null);
    }
  }

  async function reviewCustomerPrice() {
    setSavingAction("price");
    setSaveError(null);
    try {
      const target = await persist();
      const fresh = await apiGet<OrderDetail>(`/api/orders/${encodeURIComponent(target.orderId)}`);
      setPriceOrder(fresh);
      showToast({
        tone: "success",
        title: "Item saved",
        description: "Customer pricing now uses the server order basket below.",
      });
      window.setTimeout(() => priceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    } catch (error) {
      setSaveError(errorMessage(error, "Could not prepare the customer price."));
    } finally {
      setSavingAction(null);
    }
  }

  function switchMode(nextMode: ConfigureMode) {
    setActiveMode(nextMode);
    setView("external");
    setSelectedComponentId(null);
    router.replace(configureHref({
      mode: nextMode,
      family: family.family.familyKey,
      design: design.designId,
      system: draft.systemId,
      productId: productId ?? undefined,
      orderId: targetOrderId,
    }));
  }

  const modeSwitch = !targetItemId && !targetReplaceId && !committedLegacy ? (
    <div className="v2-configure-mode-actions" role="group" aria-label="Configuration mode">
      <Button
        onClick={() => switchMode("standard")}
        variant={activeMode === "standard" ? "primary" : "secondary"}
      >
        Standard
      </Button>
      <Button
        onClick={() => switchMode("custom")}
        variant={activeMode === "custom" ? "primary" : "secondary"}
      >
        Custom
      </Button>
    </div>
  ) : <StatusChip label="Custom item context" />;

  const engineeringTotal = resolved?.pricing?.totals.grandTotal;
  const currency = resolved?.pricing?.currency ?? "GBP";
  const customViews = activeMode === "custom"
    ? CUSTOM_VIEWS
    : [{ key: "external" as const, label: "2D" }, { key: "3d" as const, label: "3D" }];

  return (
    <Stack gap="section">
      <PageHeading
        actions={modeSwitch}
        description={activeMode === "custom"
          ? "Select a part on the drawing or in the inspector to expose component options and structural actions."
          : "Essential dimensions and item choices stay visible; Custom reveals component-level work without changing routes."}
        eyebrow={order ? `Order ${order.orderNo}` : activeMode === "custom" ? "Custom configuration" : "Standard quote"}
        title={design.name}
      />

      <Cluster>
        <ButtonLink
          href={targetOrderId
            ? `/v2/orders/${encodeURIComponent(targetOrderId)}/items`
            : configureHref({ mode: activeMode })}
          variant="ghost"
        >
          {targetOrderId ? "Back to order items" : "Choose another unit"}
        </ButtonLink>
        <StatusChip label={family.family.name} />
        <StatusChip
          label={resolving ? "Updating" : resolved?.blocking ? "Needs attention" : resolved ? "Ready" : "Waiting"}
          tone={resolving ? "warning" : resolved?.blocking ? "error" : resolved ? "success" : "neutral"}
        />
      </Cluster>

      {targetReplaceId ? (
        <Alert title="Converting an older item" tone="warning">
          Nothing changes until you save. Saving replaces the original line in one server transaction.
          {importIssues.length ? (
            <ul>{importIssues.map((issue, index) => <li key={index}>{issue.message}</li>)}</ul>
          ) : null}
        </Alert>
      ) : null}
      {!canPersist ? (
        <Alert title="Read-only workspace" tone="neutral">
          You can explore and resolve changes in this browser preview, but your permissions or the confirmed order state do not allow saving them.
        </Alert>
      ) : null}
      {committedLegacy ? (
        <Alert title="Standard item saved" tone="success">
          The saved Standard item is locked in this view because the existing order contract has no in-place update. Use Edit item from the order to convert and revise it safely.
        </Alert>
      ) : null}

      <Card elevation="flat">
        <dl className="v2-configure-facts">
          <div><dt>Profile system</dt><dd>{draft.systemId}</dd></div>
          <div><dt>Size</dt><dd>{draft.dimensions.widthMm} × {draft.dimensions.heightMm} mm</dd></div>
          <div><dt>Quantity</dt><dd>{draft.quantity}</dd></div>
          <div><dt>Engineering price</dt><dd>{engineeringTotal === undefined ? "—" : money(engineeringTotal, currency)}</dd></div>
        </dl>
      </Card>

      <div className="v2-configure-workspace">
        <Card elevation="flat">
          <div className="v2-configure-system-field">
            <label htmlFor="v2-configure-system">Profile system</label>
            <select
              disabled={!configurationEditable}
              id="v2-configure-system"
              onChange={(event) => dispatch({ type: "system", systemId: event.target.value })}
              value={draft.systemId}
            >
              {family.family.systemIds.map((systemId) => <option key={systemId} value={systemId}>{systemId}</option>)}
            </select>
          </div>
          <ConfigureInspector
            disabled={!configurationEditable}
            draft={draft}
            family={family}
            mode={activeMode}
            onAction={runAction}
            onChoice={(option, choiceKey, scope) => dispatch({ type: "choice", option, choiceKey, scope })}
            onDimension={(key, value) => dispatch({ type: "dimension", key, value })}
            onRemoveEdit={(editId) => dispatch({ type: "removeEdit", editId })}
            onReset={(option, scope) => dispatch({ type: "reset", optionKey: option.key, scope })}
            onSelectComponent={setSelectedComponentId}
            onSplitMode={(splitMode) => dispatch({ type: "splitMode", mode: splitMode })}
            onSplitRatio={(pathId, ratio) => dispatch({ type: "splitRatio", pathId, ratio })}
            onValue={(option, value, scope) => dispatch({ type: "value", option, value, scope })}
            resolved={resolved}
            selectedComponent={selectedComponent}
          />
        </Card>

        <Card elevation="flat">
          <div className="v2-configure-preview">
            <div className="v2-configure-preview-tools">
              <div className="v2-configure-segments" role="tablist" aria-label="Preview view">
                {customViews.map((candidate) => (
                  <button
                    aria-selected={view === candidate.key}
                    data-v2-active={view === candidate.key || undefined}
                    key={candidate.key}
                    onClick={() => setView(candidate.key)}
                    role="tab"
                    type="button"
                  >
                    {candidate.label}
                  </button>
                ))}
              </div>
              {activeMode === "standard" && view !== "3d" ? (
                <label className="v2-configure-joints">
                  <input
                    checked={showJoints && standardCompatible}
                    disabled={!standardCompatible}
                    onChange={(event) => setShowJoints(event.target.checked)}
                    type="checkbox"
                  />
                  <span>Show joints</span>
                </label>
              ) : null}
              {view !== "3d" && previewSvg ? (
                <Cluster>
                  <Button
                    onClick={() => downloadSvg(previewSvg, viewFilename(design.name, draft.dimensions.widthMm, draft.dimensions.heightMm, drawnView))}
                    variant="secondary"
                  >
                    SVG
                  </Button>
                  <Button
                    onClick={() => void downloadPng(
                      previewSvg,
                      viewFilename(design.name, draft.dimensions.widthMm, draft.dimensions.heightMm, drawnView),
                    ).catch(() => showToast({ tone: "error", title: "PNG download failed" }))}
                    variant="secondary"
                  >
                    PNG
                  </Button>
                </Cluster>
              ) : null}
            </div>

            {resolveError ? (
              <div className="v2-configure-preview-alert">
                <Alert title="Preview not updated" tone="error">{resolveError}</Alert>
              </div>
            ) : null}

            {view === "3d" && canvasGeometry ? (
              <Window3D geometry={canvasGeometry} insideHex={insideHex} outsideHex={outsideHex} />
            ) : canvasGeometry && committedLegacy && normalizedFallback ? (
              <div
                className="v2-configure-fallback-preview"
                dangerouslySetInnerHTML={{ __html: normalizedFallback }}
              />
            ) : canvasGeometry ? (
              <WindowDesigner
                components={activeMode === "custom" ? components : undefined}
                geometry={canvasGeometry}
                glassLabel={resolved?.summary?.colourLabel ?? family.family.name}
                heightMm={draft.dimensions.heightMm}
                mirrored={drawnView === "internal"}
                onHeightChange={(value) => dispatch({ type: "dimension", key: "heightMm", value })}
                onSelectComponent={activeMode === "custom" ? setSelectedComponentId : undefined}
                onSplitRatioChange={(pathId, ratio) => dispatch({ type: "splitRatio", pathId, ratio })}
                onWidthChange={(value) => dispatch({ type: "dimension", key: "widthMm", value })}
                selectedComponentId={activeMode === "custom" ? selectedComponent?.componentId ?? null : undefined}
                widthMm={draft.dimensions.widthMm}
              />
            ) : normalizedFallback ? (
              <div
                className="v2-configure-fallback-preview"
                dangerouslySetInnerHTML={{ __html: normalizedFallback }}
              />
            ) : (
              <p className="v2-configure-muted">{resolving ? "Solving configuration…" : "Enter valid dimensions to generate the preview."}</p>
            )}
          </div>
        </Card>
      </div>

      <Grid columns="two">
        <Card
          actions={<Button onClick={() => setIssuesOpen(true)} variant="secondary">Issues ({issues.length})</Button>}
          description="Resolver values are displayed directly; this UI performs no price calculation."
          title="Engineering price"
        >
          <p className="v2-configure-price">{engineeringTotal === undefined ? "—" : money(engineeringTotal, currency)}</p>
          <p className="v2-configure-muted">Per unit from the latest successful line-item resolve.</p>
        </Card>
        <Card
          description={`${resolved?.pricing?.lines.length ?? 0} server-priced lines from the current configuration.`}
          title="BOM preview"
        >
          {resolved?.pricing?.lines.length ? (
            <ul className="v2-configure-bom">
              {resolved.pricing.lines.slice(0, 10).map((line) => (
                <li key={`${line.category}-${line.code}-${line.description}`}>
                  <span><strong>{line.description}</strong><small>{line.code} · {line.qty} {line.unit}</small></span>
                  <strong>{money(line.totalPrice, currency)}</strong>
                </li>
              ))}
            </ul>
          ) : <p className="v2-configure-muted">Priced material lines appear after the first successful resolve.</p>}
        </Card>
      </Grid>

      <Section
        description="Save the configured unit to an order, or save it and reveal the server customer-price basket here."
        title="Order context"
      >
        <Card elevation="flat">
          <Stack gap="form">
            {!targetOrderId ? (
              <TextField
                disabled={!canPersist}
                label="Customer name"
                onChange={(event) => setCustomer(event.target.value)}
                required
                value={customer}
              />
            ) : null}
            <TextField
              disabled={!configurationEditable}
              label="Quantity"
              min="1"
              onChange={(event) => dispatch({
                type: "quantity",
                quantity: Math.max(1, Number.parseInt(event.target.value, 10) || 1),
              })}
              type="number"
              value={draft.quantity}
            />
            {activeMode === "standard" ? (
              <Alert title="What the Standard item stores" tone="neutral">
                Finish, cill, frame and split positions are saved. Glass affects this live engineering quote but the existing Standard order contract uses the design default when the item is stored.
              </Alert>
            ) : null}
            {!standardCanSave ? (
              <Alert title={productId ? "Custom work needs Custom mode" : "Product context missing"} tone="warning">
                {productId
                  ? "This draft contains Custom-only answers or structural changes. Switch to Custom to save the full draft."
                  : "Open this Standard layout from the task-first chooser or an existing product link before saving."}
              </Alert>
            ) : null}
            {saveError ? <Alert title="Could not save item" tone="error">{saveError}</Alert> : null}
            <Cluster>
              <Button
                disabled={!canPersist || !standardCanSave || !family.family.engine.quotable}
                loading={savingAction === "return"}
                loadingLabel="Saving item"
                onClick={saveAndReturn}
              >
                {committedLegacy ? "Return to order" : targetItemId || targetReplaceId ? "Update and return" : targetOrderId ? "Add and return" : "Create order"}
              </Button>
              <Button
                disabled={!canPersist || !standardCanSave || !family.family.engine.quotable}
                loading={savingAction === "price"}
                loadingLabel="Preparing customer price"
                onClick={reviewCustomerPrice}
                variant="secondary"
              >
                Review customer price
              </Button>
            </Cluster>
          </Stack>
        </Card>
      </Section>

      {priceOrder?.basket ? (
        <div ref={priceRef}>
          <Section
            description="The ledger and every commercial total below come from the order basket returned by the server."
            title="Customer price"
          >
            <CommercialsForm editable={priceOrder.status === "draft" && canPersist} order={priceOrder} />
          </Section>
        </div>
      ) : null}

      <Drawer
        description="Errors may block confirmation; advisory limits remain the fabricator's decision."
        footer={<Button onClick={() => setIssuesOpen(false)} variant="secondary">Close</Button>}
        onClose={() => setIssuesOpen(false)}
        open={issuesOpen}
        title={`Configuration issues (${issues.length})`}
      >
        {issues.length ? (
          <ul className="v2-configure-issues">
            {issues.map((issue, index) => {
              const fix = fixes[index];
              return (
                <li key={`${issue.kind}-${index}`}>
                  <StatusChip label={issue.severity} tone={issue.severity === "error" ? "error" : "warning"} />
                  <p>{issue.message}</p>
                  {isAdvisoryIssue(issue) ? <small>Advisory; does not block confirmation.</small> : null}
                  {fix ? <Button onClick={() => applyFix(fix)}>{fix.label}</Button> : <small>Needs a decision.</small>}
                </li>
              );
            })}
          </ul>
        ) : <Alert title="No issues" tone="success">The current resolve reports no configuration issues.</Alert>}
      </Drawer>
    </Stack>
  );
}
