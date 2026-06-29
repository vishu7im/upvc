"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { normalizeSvgForPreview } from "@/lib/svg-preview";
import type { QuoteGeometry, Rect } from "@/lib/types";

// The engine SVG (src/engine/svg.ts) is drawn with viewBox "-20 -20 (w+40) (h+40)"
// and the window frame at [0,0,w,h]. We mirror that pad here so the overlay's
// computed window-frame rect lines up exactly with the rendered profile SVG.
const PROFILE_VIEWBOX_PAD_MM = 20;
// Horizontal cill overhang each side — MUST match CILL_OVERHANG in
// src/engine/svg.ts so the overlay's viewBox equals the rendered engine SVG's.
const CILL_OVERHANG_MM = 30;
const MIN_FRAME_MM = 300;
const MIN_SPAN_MM = 120;
const LABEL_WIDTH_PX = 76;
const LABEL_HEIGHT_PX = 28;
// Fixed pixel offsets for dimension lines (never derived from values/nesting, so
// they cannot feed back into the profile's scale). Internal spans step outward
// per nesting level so nested dimensions don't collide.
const OVERALL_OFFSET_PX = 40;
const INTERNAL_BASE_OFFSET_PX = 40;
const INTERNAL_STEP_PX = 30;

type Orientation = "horizontal" | "vertical";
type SpanSide = "top" | "bottom" | "left" | "right";

/** A divider derived from solved geometry (a transom or mullion). */
interface SolvedSplit {
  /** The split node's pathId ("root", "root.top", …) — equals the divider's
   *  parentPathId, and is the key passed to the engine's splitRatios. */
  pathId: string;
  orientation: Orientation;
  /** Current solved centreline position (mm): y for horizontal, x for vertical. */
  centerMm: number;
  thicknessMm: number;
  rect: Rect;
}

interface DimensionEdit {
  type: "overall-width" | "overall-height" | "span";
  splitPathId?: string;
  orientation?: Orientation;
  side?: SpanSide;
}

interface DimensionSpec {
  id: string;
  axis: "width" | "height";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  labelX: number;
  labelY: number;
  valueMm: number;
  edit: DimensionEdit;
}

interface StageSize {
  width: number;
  height: number;
}

interface OverlayMetrics {
  stage: StageSize;
  viewBox: Rect;
  scale: number;
  svgRect: Rect;
  outerRect: Rect;
}

interface DragState {
  pathId: string;
  orientation: Orientation;
  centerMm: number;
}

export interface WindowDesignerProps {
  geometry: QuoteGeometry;
  widthMm: number;
  heightMm: number;
  glassLabel: string;
  onWidthChange: (widthMm: number) => void;
  onHeightChange: (heightMm: number) => void;
  /** Commit an internal split to a full-window fraction (multi-span editing). */
  onSplitRatioChange: (pathId: string, ratio: number) => void;
}

export default function WindowDesigner({
  geometry,
  widthMm,
  heightMm,
  glassLabel,
  onWidthChange,
  onHeightChange,
  onSplitRatioChange,
}: WindowDesignerProps) {
  const markerId = `dimension-arrow-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const stageRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<SVGSVGElement | null>(null);
  const stageSize = useElementSize(stageRef);
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [hoveredPanelId, setHoveredPanelId] = useState<string | null>(null);
  const [hoveredSplitId, setHoveredSplitId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [editingDimension, setEditingDimension] = useState<{ id: string; value: string } | null>(null);

  // The real profile SVG — ALWAYS rendered, never replaced by topology shapes.
  const profileSvg = useMemo(() => normalizeSvgForPreview(geometry.svg), [geometry.svg]);

  // Window outer box in mm = the SOLVED manufacturing frame (engine geometry.outer).
  // With a cill, outer.h is the manufacturing height (display height − 30 mm); the
  // splits/cells are solved against this, so the overlay must use it too. No cill ⇒
  // outer.h === heightMm, identical to before. Falls back to props pre-first-solve.
  const outer: Rect = useMemo(
    () => geometry.outer ?? { x: 0, y: 0, w: widthMm, h: heightMm },
    [geometry.outer, heightMm, widthMm],
  );
  // Mirror the engine SVG viewBox exactly (src/engine/svg.ts) so the overlay maps
  // mm→px identically and the SVG fills svgRect with no letterboxing. With a cill
  // the box grows by the overhang (sides) and the cill depth (bottom).
  const profileViewBox = useMemo(() => {
    const overhang = geometry.cill ? CILL_OVERHANG_MM : 0;
    const cillH = geometry.cill?.rect.h ?? 0;
    return {
      x: -(PROFILE_VIEWBOX_PAD_MM + overhang),
      y: -PROFILE_VIEWBOX_PAD_MM,
      w: outer.w + (PROFILE_VIEWBOX_PAD_MM + overhang) * 2,
      h: outer.h + cillH + PROFILE_VIEWBOX_PAD_MM * 2,
    };
  }, [geometry.cill, outer.w, outer.h]);
  // ProfileRenderer owns the one scaling calc; the overlay only consumes it.
  const metrics = useMemo(() => getOverlayMetrics(stageSize, profileViewBox, outer), [outer, profileViewBox, stageSize]);

  const splits = useMemo(() => buildSolvedSplits(geometry), [geometry]);
  const cells = useMemo(() => geometry.cells ?? [], [geometry.cells]);

  // Sliding patio has no transom/mullion splits — instead it's a row of n
  // equal/unequal framed panels. We synthesise draggable boundaries between
  // adjacent panel columns and per-panel width labels (the panels tile the
  // daylight, so adjacent cells share an edge).
  const isSliding = useMemo(
    () =>
      cells.length > 1 &&
      splits.length === 0 &&
      cells.every((c) => typeof c.content === "string" && c.content.startsWith("sliding-")),
    [cells, splits],
  );
  // The sliding node's pathId (cells are "<base>.pN"); boundary keys are "<base>.b{i}".
  const slidingBase = useMemo(
    () => (cells[0]?.pathId ? cells[0].pathId.replace(/\.p\d+$/, "") : "root"),
    [cells],
  );
  // Daylight extent the panel columns tile (mm): left edge of the first column to
  // the right edge of the last. Drag fractions are measured against this.
  const slidingDaylight = useMemo(() => {
    if (!isSliding) return null;
    const first = cells[0].outer;
    const last = cells[cells.length - 1].outer;
    const left = first.x;
    const w = Math.max(1, last.x + last.w - left);
    return { left, w };
  }, [cells, isSliding]);
  // Live drag of one interior boundary (between panel `index` and `index+1`).
  const [slidingDrag, setSlidingDrag] = useState<{ index: number; xMm: number } | null>(null);

  // Solved positions (centrelines) from the engine; drag overrides only the
  // divider being moved so its handle + span labels track the cursor live while
  // the real profile stays put until the re-solve returns.
  const solvedPositions = useMemo(
    () => Object.fromEntries(splits.map((split) => [split.pathId, split.centerMm])),
    [splits],
  );
  const displayPositions = useMemo(
    () => (drag ? { ...solvedPositions, [drag.pathId]: drag.centerMm } : solvedPositions),
    [drag, solvedPositions],
  );

  const selectedPanel = selectedPanelId ? cells.find((cell) => cell.pathId === selectedPanelId) ?? null : null;

  const dimensions = useMemo(
    () => buildScreenDimensions(splits, displayPositions, solvedPositions, outer, metrics, heightMm),
    [displayPositions, heightMm, metrics, outer, solvedPositions, splits],
  );

  function parentBoundsOf(split: SolvedSplit): Rect {
    return boundsForPath(split.pathId, splits, solvedPositions, outer);
  }

  function commitSplitCenter(split: SolvedSplit, centerMm: number) {
    const parent = parentBoundsOf(split);
    const clamped = clampSplitCenter(centerMm, split.orientation, parent);
    // Ratio is a fraction of the SOLVE dimension (= manufacturing frame, outer),
    // matching the engine's splitRatios convention — not the customer height.
    const windowDim = split.orientation === "horizontal" ? outer.h : outer.w;
    if (windowDim <= 0) return;
    onSplitRatioChange(split.pathId, clamp(clamped / windowDim, 0.02, 0.98));
  }

  function updateDragFromPointer(split: SolvedSplit, event: React.PointerEvent<SVGElement>) {
    const point = clientPointToSvg(overlayRef.current, event.clientX, event.clientY);
    if (!point) return;
    const mm = screenPointToMm(point, metrics);
    const parent = parentBoundsOf(split);
    const center = clampSplitCenter(split.orientation === "horizontal" ? mm.y : mm.x, split.orientation, parent);
    setDrag({ pathId: split.pathId, orientation: split.orientation, centerMm: center });
  }

  function commitDimension(spec: DimensionSpec | null, rawValue: string) {
    setEditingDimension(null);
    if (!spec) return;
    const value = Math.round(Number.parseFloat(rawValue));
    if (!Number.isFinite(value) || value <= 0) return;

    if (spec.edit.type === "overall-width") {
      onWidthChange(Math.max(MIN_FRAME_MM, value));
      return;
    }
    if (spec.edit.type === "overall-height") {
      onHeightChange(Math.max(MIN_FRAME_MM, value));
      return;
    }

    const split = splits.find((item) => item.pathId === spec.edit.splitPathId);
    if (!split || !spec.edit.side) return;
    const parent = parentBoundsOf(split);
    const nextCenter =
      spec.edit.side === "top"
        ? parent.y + value
        : spec.edit.side === "bottom"
          ? parent.y + parent.h - value
          : spec.edit.side === "left"
            ? parent.x + value
            : parent.x + parent.w - value;
    commitSplitCenter(split, nextCenter);
  }

  // ---- Sliding-panel boundary drag (between panel `index` and `index+1`) ----
  function updateSlidingDrag(index: number, event: React.PointerEvent<SVGElement>) {
    const point = clientPointToSvg(overlayRef.current, event.clientX, event.clientY);
    if (!point || !slidingDaylight) return;
    const mm = screenPointToMm(point, metrics);
    const left = cells[index].outer.x;                                  // left neighbour edge
    const right = cells[index + 1].outer.x + cells[index + 1].outer.w;  // right neighbour edge
    const minGap = 0.05 * slidingDaylight.w;
    const xMm = clamp(mm.x, left + minGap, right - minGap);
    setSlidingDrag({ index, xMm });
  }

  function commitSlidingDrag() {
    if (slidingDrag && slidingDaylight) {
      const fraction = clamp((slidingDrag.xMm - slidingDaylight.left) / slidingDaylight.w, 0.02, 0.98);
      onSplitRatioChange(`${slidingBase}.b${slidingDrag.index + 1}`, fraction);
    }
    setSlidingDrag(null);
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (slidingDrag) {
      updateSlidingDrag(slidingDrag.index, event);
      return;
    }
    if (!drag) return;
    const split = splits.find((item) => item.pathId === drag.pathId);
    if (split) updateDragFromPointer(split, event);
  }

  function finishDragging() {
    if (slidingDrag) {
      commitSlidingDrag();
      return;
    }
    if (drag) {
      const split = splits.find((item) => item.pathId === drag.pathId);
      if (split) commitSplitCenter(split, drag.centerMm);
    }
    setDrag(null);
  }

  return (
    <div ref={stageRef} className="relative h-full w-full min-w-0 overflow-hidden">
      {/* ProfileRenderer — the real fabrication SVG, scaled to fill the fitted box. */}
      <div
        className="design-preview-svg absolute"
        style={{
          left: metrics.svgRect.x,
          top: metrics.svgRect.y,
          width: metrics.svgRect.w,
          height: metrics.svgRect.h,
        }}
        dangerouslySetInnerHTML={{ __html: profileSvg }}
      />

      {/* DimensionOverlay — annotations only, in 1:1 pixel space. */}
      <svg
        ref={overlayRef}
        className="absolute inset-0 h-full w-full select-none"
        viewBox={`0 0 ${metrics.stage.width} ${metrics.stage.height}`}
        preserveAspectRatio="none"
        aria-label="Editable window dimensions"
        onPointerMove={handlePointerMove}
        onPointerUp={finishDragging}
        onPointerCancel={finishDragging}
      >
        <defs>
          <marker
            id={markerId}
            markerWidth="7"
            markerHeight="7"
            refX="3.5"
            refY="3.5"
            orient="auto-start-reverse"
            markerUnits="userSpaceOnUse"
          >
            <path d="M 0 0 L 7 3.5 L 0 7 z" fill="#7b8490" />
          </marker>
        </defs>

        {/* Panel hit-areas + selection/hover highlight (over the real profile). */}
        <g>
          {cells.map((cell) => {
            const rect = rectToScreen(cell.outer, metrics);
            const selected = cell.pathId === selectedPanelId;
            const hovered = cell.pathId === hoveredPanelId;
            return (
              <g
                key={cell.pathId}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedPanelId(cell.pathId)}
                onMouseEnter={() => setHoveredPanelId(cell.pathId)}
                onMouseLeave={() => setHoveredPanelId((current) => (current === cell.pathId ? null : current))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") setSelectedPanelId(cell.pathId);
                }}
              >
                {(hovered || selected) && (
                  <rect
                    x={rect.x}
                    y={rect.y}
                    width={rect.w}
                    height={rect.h}
                    fill={hovered && !selected ? "#dbeafe" : "none"}
                    opacity={hovered && !selected ? 0.25 : 1}
                    stroke={selected ? "#2563eb" : "#60a5fa"}
                    strokeWidth={selected ? 2.5 : 1.5}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill="transparent" />
              </g>
            );
          })}
        </g>

        {/* Dimension lines + editable labels. */}
        <g>
          {dimensions.map((dimension) => (
            <DimensionLine
              key={dimension.id}
              dimension={dimension}
              markerId={markerId}
              editing={editingDimension?.id === dimension.id ? editingDimension : null}
              onEdit={(value) => setEditingDimension({ id: dimension.id, value })}
              onEditingValueChange={(value) => setEditingDimension({ id: dimension.id, value })}
              onCommit={(value) => commitDimension(dimension, value)}
              onCancel={() => setEditingDimension(null)}
            />
          ))}
        </g>

        {/* Drag handles on dividers (revealed on hover / when a bounded panel is selected). */}
        <g>
          {splits.map((split) => {
            const center = displayPositions[split.pathId] ?? split.centerMm;
            const parent = boundsForPath(split.pathId, splits, displayPositions, outer);
            const stripRect =
              split.orientation === "horizontal"
                ? { x: parent.x, y: center - split.thicknessMm / 2, w: parent.w, h: split.thicknessMm }
                : { x: center - split.thicknessMm / 2, y: parent.y, w: split.thicknessMm, h: parent.h };
            const rect = rectToScreen(stripRect, metrics);
            const cx = rect.x + rect.w / 2;
            const cy = rect.y + rect.h / 2;
            const hovered = hoveredSplitId === split.pathId;
            const dragging = drag?.pathId === split.pathId;
            const relatedToSelection = selectedPanelId ? isBoundingSplit(split.pathId, selectedPanelId) : false;
            const active = hovered || dragging || relatedToSelection;
            const handleW = split.orientation === "horizontal" ? 64 : 24;
            const handleH = split.orientation === "horizontal" ? 24 : 64;
            const hitRect =
              split.orientation === "horizontal"
                ? { x: rect.x, y: cy - 13, w: rect.w, h: 26 }
                : { x: cx - 13, y: rect.y, w: 26, h: rect.h };

            return (
              <g
                key={split.pathId}
                onMouseEnter={() => setHoveredSplitId(split.pathId)}
                onMouseLeave={() => setHoveredSplitId((current) => (current === split.pathId ? null : current))}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  updateDragFromPointer(split, event);
                }}
                className={split.orientation === "horizontal" ? "cursor-ns-resize" : "cursor-ew-resize"}
              >
                <rect x={hitRect.x} y={hitRect.y} width={hitRect.w} height={hitRect.h} fill="transparent" />
                {active && (
                  <>
                    <rect
                      x={cx - handleW / 2}
                      y={cy - handleH / 2}
                      width={handleW}
                      height={handleH}
                      rx="5"
                      fill="#2563eb"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                    <path
                      d={
                        split.orientation === "horizontal"
                          ? `M ${cx - 15} ${cy - 3} L ${cx} ${cy - 11} L ${cx + 15} ${cy - 3} M ${cx - 15} ${cy + 3} L ${cx} ${cy + 11} L ${cx + 15} ${cy + 3}`
                          : `M ${cx - 3} ${cy - 15} L ${cx - 11} ${cy} L ${cx - 3} ${cy + 15} M ${cx + 3} ${cy - 15} L ${cx + 11} ${cy} L ${cx + 3} ${cy + 15}`
                      }
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </>
                )}
              </g>
            );
          })}
        </g>

        {/* Sliding patio: per-panel width labels + draggable boundary handles. */}
        {isSliding && slidingDaylight && (
          <g>
            {/* Per-panel width labels (read-only) below the frame. */}
            {cells.map((cell) => {
              const panel = rectToScreen(cell.outer, metrics);
              const lineY = metrics.outerRect.y + metrics.outerRect.h + INTERNAL_BASE_OFFSET_PX;
              const widthMmValue = (cell.sashOuter ?? cell.outer).w;
              const labelX = clampLabelX(panel.x + panel.w / 2, metrics);
              return (
                <g key={`slabel-${cell.pathId}`}>
                  <line
                    x1={panel.x}
                    y1={lineY}
                    x2={panel.x + panel.w}
                    y2={lineY}
                    stroke="#7b8490"
                    strokeWidth="1.4"
                    markerStart={`url(#${markerId})`}
                    markerEnd={`url(#${markerId})`}
                  />
                  <line x1={panel.x} y1={lineY - 8} x2={panel.x} y2={lineY + 8} stroke="#7b8490" strokeWidth="1.2" />
                  <line x1={panel.x + panel.w} y1={lineY - 8} x2={panel.x + panel.w} y2={lineY + 8} stroke="#7b8490" strokeWidth="1.2" />
                  <foreignObject
                    x={labelX - LABEL_WIDTH_PX / 2}
                    y={clampLabelY(lineY, metrics) - LABEL_HEIGHT_PX / 2}
                    width={LABEL_WIDTH_PX}
                    height={LABEL_HEIGHT_PX}
                  >
                    <div className="flex h-[28px] w-[76px] items-center justify-center rounded border border-slate-300 bg-white px-2 text-center font-mono text-[12px] font-semibold leading-none text-slate-700 shadow-[0_6px_14px_rgba(15,23,42,0.14)]">
                      {roundMm(widthMmValue)}
                    </div>
                  </foreignObject>
                </g>
              );
            })}

            {/* Interior boundary handles (n−1) — drag to resize adjacent panels. */}
            {cells.slice(0, -1).map((cell, index) => {
              const xMm =
                slidingDrag?.index === index ? slidingDrag.xMm : cell.outer.x + cell.outer.w;
              const cx = xToScreen(xMm, metrics);
              const top = metrics.outerRect.y;
              const bottom = metrics.outerRect.y + metrics.outerRect.h;
              const cy = (top + bottom) / 2;
              const dragging = slidingDrag?.index === index;
              const hovered = hoveredSplitId === `${slidingBase}.b${index + 1}`;
              const active = dragging || hovered;
              return (
                <g
                  key={`sbound-${index}`}
                  onMouseEnter={() => setHoveredSplitId(`${slidingBase}.b${index + 1}`)}
                  onMouseLeave={() =>
                    setHoveredSplitId((current) => (current === `${slidingBase}.b${index + 1}` ? null : current))
                  }
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    updateSlidingDrag(index, event);
                  }}
                  className="cursor-ew-resize"
                >
                  {/* full-height hit strip */}
                  <rect x={cx - 13} y={top} width={26} height={bottom - top} fill="transparent" />
                  {/* live guide line while dragging */}
                  {dragging && (
                    <line x1={cx} y1={top} x2={cx} y2={bottom} stroke="#2563eb" strokeWidth="1.5" strokeDasharray="5 4" />
                  )}
                  {active && (
                    <>
                      <rect x={cx - 12} y={cy - 32} width={24} height={64} rx="5" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
                      <path
                        d={`M ${cx - 3} ${cy - 15} L ${cx - 11} ${cy} L ${cx - 3} ${cy + 15} M ${cx + 3} ${cy - 15} L ${cx + 11} ${cy} L ${cx + 3} ${cy + 15}`}
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </>
                  )}
                </g>
              );
            })}
          </g>
        )}
      </svg>

      {selectedPanel && (
        <div className="absolute bottom-3 left-3 w-[min(280px,calc(100%-24px))] rounded-md border border-slate-200 bg-white/95 p-3 text-sm shadow-[0_16px_34px_rgba(15,23,42,0.14)] backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-[#4442e3]">Properties</p>
              <p className="mt-1 truncate font-semibold text-slate-950">{panelDisplayName(selectedPanel.pathId)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-slate-100 px-2 py-1 font-mono text-[11px] font-semibold text-slate-600">
                {selectedPanel.pathId}
              </span>
              <button
                type="button"
                onClick={() => setSelectedPanelId(null)}
                aria-label="Close properties"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M3 3l10 10M13 3L3 13" />
                </svg>
              </button>
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            {/* Sliding panels: show the actual sash (panel) cut width, not the
                visual daylight column. Other families keep the cell outer. */}
            <Property
              label="Width"
              value={`${roundMm(
                selectedPanel.content?.startsWith("sliding-") && selectedPanel.sashOuter
                  ? selectedPanel.sashOuter.w
                  : selectedPanel.outer.w,
              )} mm`}
            />
            <Property label="Height" value={`${roundMm(selectedPanel.outer.h)} mm`} />
            <Property label="Glass Type" value={glassLabel} />
            <Property label="Opening Type" value={openingLabel(selectedPanel.content)} />
          </dl>
        </div>
      )}
    </div>
  );
}

function DimensionLine({
  dimension,
  markerId,
  editing,
  onEdit,
  onEditingValueChange,
  onCommit,
  onCancel,
}: {
  dimension: DimensionSpec;
  markerId: string;
  editing: { id: string; value: string } | null;
  onEdit: (value: string) => void;
  onEditingValueChange: (value: string) => void;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const valueText = `${roundMm(dimension.valueMm)} `;

  return (
    <g>
      <line
        x1={dimension.x1}
        y1={dimension.y1}
        x2={dimension.x2}
        y2={dimension.y2}
        stroke="#7b8490"
        strokeWidth="1.4"
        markerStart={`url(#${markerId})`}
        markerEnd={`url(#${markerId})`}
      />
      {dimension.axis === "width" ? (
        <>
          <line x1={dimension.x1} y1={dimension.y1 - 8} x2={dimension.x1} y2={dimension.y1 + 8} stroke="#7b8490" strokeWidth="1.2" />
          <line x1={dimension.x2} y1={dimension.y2 - 8} x2={dimension.x2} y2={dimension.y2 + 8} stroke="#7b8490" strokeWidth="1.2" />
        </>
      ) : (
        <>
          <line x1={dimension.x1 - 8} y1={dimension.y1} x2={dimension.x1 + 8} y2={dimension.y1} stroke="#7b8490" strokeWidth="1.2" />
          <line x1={dimension.x2 - 8} y1={dimension.y2} x2={dimension.x2 + 8} y2={dimension.y2} stroke="#7b8490" strokeWidth="1.2" />
        </>
      )}

      <foreignObject
        x={dimension.labelX - LABEL_WIDTH_PX / 2}
        y={dimension.labelY - LABEL_HEIGHT_PX / 2}
        width={LABEL_WIDTH_PX}
        height={LABEL_HEIGHT_PX}
      >
        {editing ? (
          <DimensionInput
            value={editing.value}
            onChange={onEditingValueChange}
            onCommit={onCommit}
            onCancel={onCancel}
          />
        ) : (
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onEdit(String(roundMm(dimension.valueMm)))}
            className="flex h-[28px] min-h-[28px] w-[76px] min-w-[60px] items-center justify-center rounded border border-slate-300 bg-white px-2 text-center font-mono text-[12px] font-semibold leading-none text-slate-700 shadow-[0_6px_14px_rgba(15,23,42,0.14)]"
          >
            {valueText}
          </button>
        )}
      </foreignObject>
    </g>
  );
}

function DimensionInput({
  value,
  onChange,
  onCommit,
  onCancel,
}: {
  value: string;
  onChange: (value: string) => void;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <input
      ref={inputRef}
      type="number"
      min={1}
      value={value}
      onPointerDown={(event) => event.stopPropagation()}
      onChange={(event) => onChange(event.target.value)}
      onBlur={() => onCommit(value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onCommit(value);
        if (event.key === "Escape") onCancel();
      }}
      className="h-[28px] w-[76px] min-w-[60px] rounded border border-blue-400 bg-white px-2 text-center font-mono text-[12px] font-semibold leading-none text-slate-950 shadow-[0_6px_14px_rgba(15,23,42,0.16)] outline-none"
    />
  );
}

function Property({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
      <dt className="truncate text-[10px] font-semibold uppercase text-slate-500">{label}</dt>
      <dd className="mt-0.5 truncate font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

/** Derive editable dividers from the solved transoms/mullions. */
function buildSolvedSplits(geometry: QuoteGeometry): SolvedSplit[] {
  const splits: SolvedSplit[] = [];
  for (const transom of geometry.transoms ?? []) {
    splits.push({
      pathId: transom.parentPathId,
      orientation: "horizontal",
      centerMm: transom.rect.y + transom.rect.h / 2,
      thicknessMm: transom.rect.h,
      rect: transom.rect,
    });
  }
  for (const mullion of geometry.mullions ?? []) {
    splits.push({
      pathId: mullion.parentPathId,
      orientation: "vertical",
      centerMm: mullion.rect.x + mullion.rect.w / 2,
      thicknessMm: mullion.rect.w,
      rect: mullion.rect,
    });
  }
  return splits;
}

function buildScreenDimensions(
  splits: SolvedSplit[],
  displayPositions: Record<string, number>,
  parentPositions: Record<string, number>,
  outer: Rect,
  metrics: OverlayMetrics,
  // Customer-facing overall height (mm). With a cill this differs from outer.h
  // (the manufacturing frame): the label shows the customer height while the line
  // still spans the drawn frame. No cill ⇒ === outer.h.
  displayHeightMm: number,
): DimensionSpec[] {
  const outerRect = metrics.outerRect;
  // The overall-height line spans the full CUSTOMER height: frame (outer.h) plus
  // the cill engagement (displayHeightMm − outer.h, the fixed 30 mm deduction), so
  // the "1200" reaches down into the cill rather than stopping at the frame bottom.
  // No cill ⇒ displayHeightMm === outer.h, so the bottom is the frame bottom (== old).
  const overallHeightBottomY = yToScreen(outer.y + displayHeightMm, metrics);
  const dimensions: DimensionSpec[] = [
    {
      id: "overall-width",
      axis: "width",
      x1: outerRect.x,
      y1: outerRect.y - OVERALL_OFFSET_PX,
      x2: outerRect.x + outerRect.w,
      y2: outerRect.y - OVERALL_OFFSET_PX,
      labelX: clampLabelX(outerRect.x + outerRect.w / 2, metrics),
      labelY: clampLabelY(outerRect.y - OVERALL_OFFSET_PX, metrics),
      valueMm: outer.w,
      edit: { type: "overall-width" },
    },
    {
      id: "overall-height",
      axis: "height",
      x1: outerRect.x - OVERALL_OFFSET_PX,
      y1: outerRect.y,
      x2: outerRect.x - OVERALL_OFFSET_PX,
      y2: overallHeightBottomY,
      labelX: clampLabelX(outerRect.x - OVERALL_OFFSET_PX - 2, metrics),
      labelY: clampLabelY((outerRect.y + overallHeightBottomY) / 2, metrics),
      valueMm: displayHeightMm,
      edit: { type: "overall-height" },
    },
  ];

  for (const split of splits) {
    // Parent region uses solved ancestor positions; the split's own centreline
    // uses display positions so its labels track an in-progress drag.
    const parent = boundsForPath(split.pathId, splits, parentPositions, outer);
    const parentRect = rectToScreen(parent, metrics);
    const position = displayPositions[split.pathId] ?? split.centerMm;
    const offset = INTERNAL_BASE_OFFSET_PX + INTERNAL_STEP_PX * pathDepth(split.pathId);

    if (split.orientation === "horizontal") {
      const splitY = yToScreen(position, metrics);
      const lineX = parentRect.x + parentRect.w + offset;
      dimensions.push(
        {
          id: `${split.pathId}:top`,
          axis: "height",
          x1: lineX,
          y1: parentRect.y,
          x2: lineX,
          y2: splitY,
          labelX: clampLabelX(lineX, metrics),
          labelY: clampLabelY(parentRect.y + (splitY - parentRect.y) / 2, metrics),
          valueMm: position - parent.y,
          edit: { type: "span", splitPathId: split.pathId, orientation: split.orientation, side: "top" },
        },
        {
          id: `${split.pathId}:bottom`,
          axis: "height",
          x1: lineX,
          y1: splitY,
          x2: lineX,
          y2: parentRect.y + parentRect.h,
          labelX: clampLabelX(lineX, metrics),
          labelY: clampLabelY(splitY + (parentRect.y + parentRect.h - splitY) / 2, metrics),
          valueMm: parent.y + parent.h - position,
          edit: { type: "span", splitPathId: split.pathId, orientation: split.orientation, side: "bottom" },
        },
      );
    } else {
      const splitX = xToScreen(position, metrics);
      const lineY = parentRect.y + parentRect.h + offset;
      dimensions.push(
        {
          id: `${split.pathId}:left`,
          axis: "width",
          x1: parentRect.x,
          y1: lineY,
          x2: splitX,
          y2: lineY,
          labelX: clampLabelX(parentRect.x + (splitX - parentRect.x) / 2, metrics),
          labelY: clampLabelY(lineY, metrics),
          valueMm: position - parent.x,
          edit: { type: "span", splitPathId: split.pathId, orientation: split.orientation, side: "left" },
        },
        {
          id: `${split.pathId}:right`,
          axis: "width",
          x1: splitX,
          y1: lineY,
          x2: parentRect.x + parentRect.w,
          y2: lineY,
          labelX: clampLabelX(splitX + (parentRect.x + parentRect.w - splitX) / 2, metrics),
          labelY: clampLabelY(lineY, metrics),
          valueMm: parent.x + parent.w - position,
          edit: { type: "span", splitPathId: split.pathId, orientation: split.orientation, side: "right" },
        },
      );
    }
  }

  return dimensions;
}

/**
 * Bounds (mm) of the region addressed by `pathId`, reconstructed by the same
 * guillotine walk solveTopology uses — but fed with solved/dragged centrelines
 * (`positions`, keyed by split node pathId) rather than ratios.
 */
function boundsForPath(
  pathId: string,
  splits: SolvedSplit[],
  positions: Record<string, number>,
  outer: Rect,
): Rect {
  const byNode = new Map(splits.map((split) => [split.pathId, split]));
  let bounds = { ...outer };
  let currentPath = "root";
  const parts = pathId.split(".").slice(1);

  for (const part of parts) {
    const split = byNode.get(currentPath);
    if (!split) break;
    const position = positions[split.pathId] ?? split.centerMm;

    if (split.orientation === "horizontal") {
      if (part === "top") bounds = { x: bounds.x, y: bounds.y, w: bounds.w, h: position - bounds.y };
      else if (part === "bottom") bounds = { x: bounds.x, y: position, w: bounds.w, h: bounds.y + bounds.h - position };
    } else if (part === "left") {
      bounds = { x: bounds.x, y: bounds.y, w: position - bounds.x, h: bounds.h };
    } else if (part === "right") {
      bounds = { x: position, y: bounds.y, w: bounds.x + bounds.w - position, h: bounds.h };
    }

    currentPath += `.${part}`;
  }

  return { x: bounds.x, y: bounds.y, w: Math.max(0, bounds.w), h: Math.max(0, bounds.h) };
}

function getOverlayMetrics(stageSize: StageSize, viewBox: Rect, outer: Rect): OverlayMetrics {
  const stage = {
    width: Math.max(1, stageSize.width || 900),
    height: Math.max(1, stageSize.height || 620),
  };
  // Fixed pixel gutter for dimensions — the window fits the canvas MINUS this
  // gutter (never window+dimensions), so it always occupies ~80–90% and edits
  // never change the scale.
  const margin = overlayMarginPx(stage);
  const contentW = Math.max(1, stage.width - margin * 2);
  const contentH = Math.max(1, stage.height - margin * 2);
  const scale = Math.min(contentW / viewBox.w, contentH / viewBox.h);
  const svgW = viewBox.w * scale;
  const svgH = viewBox.h * scale;
  const svgRect = {
    x: margin + (contentW - svgW) / 2,
    y: margin + (contentH - svgH) / 2,
    w: svgW,
    h: svgH,
  };

  return {
    stage,
    viewBox,
    scale,
    svgRect,
    outerRect: rectToScreenWith(svgRect, viewBox, outer),
  };
}

function overlayMarginPx(stage: StageSize): number {
  return Math.round(clamp(Math.min(stage.width, stage.height) * 0.11, 48, 80));
}

function useElementSize(ref: React.RefObject<HTMLElement | null>): StageSize {
  const [size, setSize] = useState<StageSize>({ width: 0, height: 0 });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new ResizeObserver(([entry]) => {
      const next = entry?.contentRect;
      if (!next) return;
      setSize((previous) => {
        const width = Math.round(next.width);
        const height = Math.round(next.height);
        return previous.width === width && previous.height === height ? previous : { width, height };
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

function rectToScreen(rect: Rect, metrics: OverlayMetrics): Rect {
  return rectToScreenWith(metrics.svgRect, metrics.viewBox, rect);
}

function rectToScreenWith(svgRect: Rect, viewBox: Rect, rect: Rect): Rect {
  const scaleX = svgRect.w / viewBox.w;
  const scaleY = svgRect.h / viewBox.h;
  return {
    x: svgRect.x + (rect.x - viewBox.x) * scaleX,
    y: svgRect.y + (rect.y - viewBox.y) * scaleY,
    w: rect.w * scaleX,
    h: rect.h * scaleY,
  };
}

function xToScreen(x: number, metrics: OverlayMetrics): number {
  return metrics.svgRect.x + (x - metrics.viewBox.x) * metrics.scale;
}

function yToScreen(y: number, metrics: OverlayMetrics): number {
  return metrics.svgRect.y + (y - metrics.viewBox.y) * metrics.scale;
}

function screenPointToMm(point: { x: number; y: number }, metrics: OverlayMetrics): { x: number; y: number } {
  return {
    x: metrics.viewBox.x + (point.x - metrics.svgRect.x) / metrics.scale,
    y: metrics.viewBox.y + (point.y - metrics.svgRect.y) / metrics.scale,
  };
}

function clientPointToSvg(svg: SVGSVGElement | null, clientX: number, clientY: number): { x: number; y: number } | null {
  if (!svg) return null;
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const svgPoint = point.matrixTransform(matrix.inverse());
  return { x: svgPoint.x, y: svgPoint.y };
}

function clampSplitCenter(value: number, orientation: Orientation, parent: Rect): number {
  if (orientation === "horizontal") {
    const pad = Math.min(MIN_SPAN_MM, parent.h / 2);
    const min = parent.y + pad;
    const max = parent.y + parent.h - pad;
    return max < min ? parent.y + parent.h / 2 : clamp(value, min, max);
  }
  const pad = Math.min(MIN_SPAN_MM, parent.w / 2);
  const min = parent.x + pad;
  const max = parent.x + parent.w - pad;
  return max < min ? parent.x + parent.w / 2 : clamp(value, min, max);
}

/** True when `splitPathId` is a divider bounding the region of `panelId`. */
function isBoundingSplit(splitPathId: string, panelId: string): boolean {
  return panelId === splitPathId || panelId.startsWith(`${splitPathId}.`);
}

function clampLabelX(x: number, metrics: OverlayMetrics): number {
  return clamp(x, LABEL_WIDTH_PX / 2 + 4, metrics.stage.width - LABEL_WIDTH_PX / 2 - 4);
}

function clampLabelY(y: number, metrics: OverlayMetrics): number {
  return clamp(y, LABEL_HEIGHT_PX / 2 + 4, metrics.stage.height - LABEL_HEIGHT_PX / 2 - 4);
}

function panelDisplayName(pathId: string): string {
  if (pathId === "root") return "Root Span";
  return `${pathId
    .split(".")
    .slice(1)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")} Span`;
}

function openingLabel(content: string): string {
  const labels: Record<string, string> = {
    fixed: "Fixed",
    "casement-side-left": "Side hung left",
    "casement-side-right": "Side hung right",
    "casement-top": "Top hung",
    "tilt-turn": "Tilt and turn",
    "door-right": "Door right",
    "door-left": "Door left",
    "sliding-fixed": "Fixed panel",
    "sliding-slide-left": "Sliding ←",
    "sliding-slide-right": "Sliding →",
  };
  return labels[content] ?? content;
}

function pathDepth(pathId: string): number {
  return Math.max(0, pathId.split(".").length - 1);
}

function roundMm(value: number): number {
  return Math.round(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
