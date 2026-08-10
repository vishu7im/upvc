"use client";

import { useMemo, useState } from "react";
import { Button, TextField } from "@/components/v2";
import {
  actionOptionsFor,
  applyScopesFor,
  defaultChoiceKey,
  describeEdit,
  effectiveAnswer,
  isAnswered,
  isItemAnswerable,
  isLocationOption,
  optionAppliesTo,
  optionMatches,
  scopeKeyFor,
} from "@/lib/designer-draft";
import type {
  ApplyScope,
  ComponentRef,
  FamilyResponse,
  LineItemDraft,
  LineItemIssue,
  OptionDef,
  QuoteGeometry,
  ResolvedLineItem,
  SplitMode,
  TopologyEditTemplate,
} from "@/lib/types";
import { standardOptionGroups, type ConfigureMode } from "@/lib/v2/configure";
import { ConfigureOption } from "./configure-option";

const ROWS_BEFORE_MORE = 3;

const SPLIT_MODE_LABEL: Record<SplitMode, string> = {
  byDimensions: "Manual",
  equalSplit: "Equal split",
  equalGlass: "Equal glass",
};

interface Span {
  pathId: string;
  orientation: "horizontal" | "vertical";
  centerMm: number;
  label: string;
}

function spansFor(geometry: Omit<QuoteGeometry, "svg"> | undefined): Span[] {
  if (!geometry) return [];
  const spans: Span[] = [];
  [...(geometry.transoms ?? [])]
    .sort((a, b) => a.rect.y - b.rect.y)
    .forEach((transom, index) => spans.push({
      pathId: transom.parentPathId,
      orientation: "horizontal",
      centerMm: Math.round(transom.rect.y + transom.rect.h / 2),
      label: `Horizontal split ${index + 1}`,
    }));
  [...(geometry.mullions ?? [])]
    .sort((a, b) => a.rect.x - b.rect.x)
    .forEach((mullion, index) => spans.push({
      pathId: mullion.parentPathId,
      orientation: "vertical",
      centerMm: Math.round(mullion.rect.x + mullion.rect.w / 2),
      label: `Vertical split ${index + 1}`,
    }));
  return spans;
}

function DimensionField({
  disabled,
  issue,
  label,
  max,
  min,
  onChange,
  value,
}: {
  disabled: boolean;
  issue?: LineItemIssue;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  value: number | undefined;
}) {
  const common = {
    disabled,
    hint: `Accepted range ${min}–${max} mm.`,
    inputMode: "numeric" as const,
    label,
    max,
    min,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange(
      event.target.value === "" ? Number.NaN : Number(event.target.value),
    ),
    type: "number" as const,
    unit: "mm",
    value: Number.isFinite(value) ? value : "",
  };
  return issue
    ? <TextField {...common} state="error" stateMessage={issue.message} />
    : <TextField {...common} />;
}

function MeasurementsPanel({
  disabled,
  draft,
  family,
  issues,
  onChoice,
  onDimension,
  onReset,
  onSplitMode,
  onSplitRatio,
  onValue,
  resolved,
}: InspectorCallbacks & {
  disabled: boolean;
  draft: LineItemDraft;
  family: FamilyResponse;
  issues: LineItemIssue[];
  resolved: ResolvedLineItem | null;
}) {
  const spans = spansFor(resolved?.geometry);
  const unsupported = new Set(
    issues
      .filter((issue) => issue.kind === "not-implemented")
      .flatMap((issue) => family.family.splitModes.filter((mode) => issue.message.includes(`"${mode}"`))),
  );
  const modes = family.family.splitModes.filter((mode) => !unsupported.has(mode));
  const splitMode = draft.splitMode ?? "byDimensions";
  const locationOption = family.optionSystem.groups
    .flatMap((group) => group.options)
    .find(isLocationOption);

  return (
    <div className="v2-configure-inspector-scroll">
      <section className="v2-configure-inspector-section">
        <h3>Dimensions</h3>
        <div className="v2-configure-field-stack">
          {family.family.dimensions.map((dimension) => (
            <DimensionField
              disabled={disabled}
              issue={issues.find((issue) => issue.dimensionKey === dimension.key)}
              key={dimension.key}
              label={dimension.label}
              max={dimension.max}
              min={dimension.min}
              onChange={(value) => onDimension(dimension.key, value)}
              value={draft.dimensions[dimension.key]}
            />
          ))}
        </div>
      </section>

      {modes.length > 1 ? (
        <section className="v2-configure-inspector-section">
          <h3>Split position</h3>
          <div aria-label="Split position" className="v2-configure-segments" role="radiogroup">
            {modes.map((mode) => (
              <button
                aria-checked={splitMode === mode}
                data-v2-active={splitMode === mode || undefined}
                disabled={disabled}
                key={mode}
                onClick={() => onSplitMode(mode)}
                role="radio"
                type="button"
              >
                {SPLIT_MODE_LABEL[mode]}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="v2-configure-inspector-section">
        <h3>Spans</h3>
        {spans.length ? (
          <div className="v2-configure-field-stack">
            {spans.map((span) => (
              <TextField
                defaultValue={span.centerMm}
                disabled={disabled || splitMode !== "byDimensions"}
                hint={`Measured from the ${span.orientation === "horizontal" ? "top" : "left"}. Commit on blur.`}
                key={`${span.pathId}-${span.orientation}-${span.centerMm}`}
                label={span.label}
                min="1"
                onBlur={(event) => {
                  const mm = Math.round(Number(event.target.value));
                  const outer = resolved?.geometry?.outer;
                  const dimension = span.orientation === "horizontal" ? outer?.h : outer?.w;
                  if (dimension && Number.isFinite(mm) && mm > 0 && mm < dimension) {
                    onSplitRatio(span.pathId, mm / dimension);
                  }
                }}
                type="number"
                unit="mm"
              />
            ))}
          </div>
        ) : <p className="v2-configure-muted">This layout has no divider span to position.</p>}
      </section>

      {locationOption ? (
        <section className="v2-configure-inspector-section">
          <h3>Placement</h3>
          <ConfigureOption
            disabled={disabled}
            draft={draft}
            issues={issues}
            onChoice={onChoice}
            onReset={onReset}
            onValue={onValue}
            option={locationOption}
          />
        </section>
      ) : null}
    </div>
  );
}

function ActionControl({
  disabled,
  draft,
  onRun,
  option,
}: {
  disabled: boolean;
  draft: LineItemDraft;
  onRun: (atRatio?: number, choiceKey?: string) => void;
  option: OptionDef;
}) {
  const template = option.action as TopologyEditTemplate | undefined;
  const needsRatio = Boolean(template && "position" in template && template.position === "at-ratio");
  const horizontal = Boolean(template && "axis" in template && template.axis === "horizontal");
  const span = horizontal ? draft.dimensions.heightMm : draft.dimensions.widthMm;
  const [millimetres, setMillimetres] = useState(String(Math.round(span / 2)));
  const [choiceKey, setChoiceKey] = useState(defaultChoiceKey(option) ?? "");

  return (
    <div className="v2-configure-action-row">
      <div>
        <strong>{option.name}</strong>
        {option.presentation?.helpText ? <p>{option.presentation.helpText}</p> : null}
      </div>
      {option.choices.length ? (
        <label>
          <span>Section</span>
          <select disabled={disabled} onChange={(event) => setChoiceKey(event.target.value)} value={choiceKey}>
            {option.choices.map((choice) => <option key={choice.key} value={choice.key}>{choice.label}</option>)}
          </select>
        </label>
      ) : null}
      {needsRatio ? (
        <label>
          <span>{horizontal ? "Drop" : "From left"}</span>
          <input
            disabled={disabled}
            max={Math.max(1, Math.round(span) - 1)}
            min="1"
            onChange={(event) => setMillimetres(event.target.value)}
            type="number"
            value={millimetres}
          />
        </label>
      ) : null}
      <Button
        disabled={disabled}
        onClick={() => {
          const mm = Number(millimetres);
          const ratio = needsRatio && Number.isFinite(mm) && mm > 0 && mm < span ? mm / span : undefined;
          if (needsRatio && ratio === undefined) return;
          onRun(ratio, choiceKey || undefined);
        }}
        variant="secondary"
      >
        Apply
      </Button>
    </div>
  );
}

interface InspectorCallbacks {
  onAction: (option: OptionDef, atRatio?: number, choiceKey?: string) => void;
  onChoice: (option: OptionDef, choiceKey: string, scope?: string) => void;
  onDimension: (key: string, value: number) => void;
  onRemoveEdit: (editId: string) => void;
  onReset: (option: OptionDef, scope?: string) => void;
  onSplitMode: (mode: SplitMode) => void;
  onSplitRatio: (pathId: string, ratio: number) => void;
  onValue: (option: OptionDef, value: string | number, scope?: string) => void;
}

export function ConfigureInspector({
  disabled,
  draft,
  family,
  mode,
  onAction,
  onChoice,
  onDimension,
  onRemoveEdit,
  onReset,
  onSelectComponent,
  onSplitMode,
  onSplitRatio,
  onValue,
  resolved,
  selectedComponent,
}: InspectorCallbacks & {
  disabled: boolean;
  draft: LineItemDraft;
  family: FamilyResponse;
  mode: ConfigureMode;
  onSelectComponent: (componentId: string | null) => void;
  resolved: ResolvedLineItem | null;
  selectedComponent: ComponentRef | null;
}) {
  const [tab, setTab] = useState<"measurements" | "product">("measurements");
  const [query, setQuery] = useState("");
  const [panelScope, setPanelScope] = useState<ApplyScope>("this");
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
  const issues = resolved?.issues ?? [];
  const components = resolved?.components ?? [];
  const sourceGroups = mode === "standard"
    ? standardOptionGroups(family.optionSystem.groups)
    : family.optionSystem.groups;

  const groups = useMemo(() => sourceGroups
    .map((group) => ({
      ...group,
      options: group.options.filter((option) => {
        if (isLocationOption(option) || option.display === "action") return false;
        const inScope = selectedComponent
          ? optionAppliesTo(option, selectedComponent)
          : isItemAnswerable(option);
        return inScope && (!query.trim() || optionMatches(option, query));
      }),
    }))
    .filter((group) => group.options.length > 0)
    .sort((a, b) => a.order - b.order), [sourceGroups, selectedComponent, query]);

  const scopes = selectedComponent
    ? [...new Set(groups.flatMap((group) => group.options.flatMap(applyScopesFor)))]
    : [];
  const scope = selectedComponent ? scopeKeyFor(selectedComponent, panelScope) : undefined;
  const actions = mode === "custom"
    ? actionOptionsFor(family.optionSystem.groups, selectedComponent)
    : [];

  return (
    <div className="v2-configure-inspector">
      <div className="v2-configure-inspector-tabs" role="tablist" aria-label="Configuration inspector">
        {([[
          "measurements",
          mode === "standard" ? "Essentials" : "Measurements",
        ], [
          "product",
          mode === "standard" ? "Item options" : "Product",
        ]] as const).map(([key, label]) => (
          <button
            aria-selected={tab === key}
            data-v2-active={tab === key || undefined}
            key={key}
            onClick={() => setTab(key)}
            role="tab"
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "measurements" ? (
        <MeasurementsPanel
          disabled={disabled}
          draft={draft}
          family={family}
          issues={issues}
          onAction={onAction}
          onChoice={onChoice}
          onDimension={onDimension}
          onRemoveEdit={onRemoveEdit}
          onReset={onReset}
          onSplitMode={onSplitMode}
          onSplitRatio={onSplitRatio}
          onValue={onValue}
          resolved={resolved}
        />
      ) : (
        <div className="v2-configure-inspector-scroll">
          <div className="v2-configure-scope-bar">
            <strong>{selectedComponent?.label ?? "Whole item"}</strong>
            {selectedComponent ? (
              <Button onClick={() => onSelectComponent(null)} variant="ghost">Whole item</Button>
            ) : null}
          </div>

          {mode === "custom" ? (
            <div className="v2-configure-option-search">
              <TextField
                label="Search product options"
                onChange={(event) => setQuery(event.target.value)}
                type="search"
                value={query}
              />
            </div>
          ) : null}

          {selectedComponent && scopes.length > 1 ? (
            <div className="v2-configure-apply-scope">
              <span>Apply answers to</span>
              <div className="v2-configure-segments" role="radiogroup" aria-label="Apply answers to">
                {scopes.map((candidate) => (
                  <button
                    aria-checked={panelScope === candidate}
                    data-v2-active={panelScope === candidate || undefined}
                    key={candidate}
                    onClick={() => setPanelScope(candidate)}
                    role="radio"
                    type="button"
                  >
                    {candidate === "this" ? "This part" : "All of this type"}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {actions.length ? (
            <section className="v2-configure-inspector-section">
              <h3>Structural actions</h3>
              <div className="v2-configure-action-list">
                {actions.map((option) => (
                  <ActionControl
                    disabled={disabled}
                    draft={draft}
                    key={option.key}
                    onRun={(ratio, choiceKey) => onAction(option, ratio, choiceKey)}
                    option={option}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {groups.map((group, groupIndex) => {
            const open = openGroup === group.key || (openGroup === null && groupIndex === 0);
            const expanded = expandedGroups.has(group.key);
            const important = group.options.filter((option) => {
              const answer = effectiveAnswer(draft, option, selectedComponent ?? undefined);
              return isAnswered(answer) || option.required || issues.some((issue) => issue.optionKey === option.key);
            });
            const visible = expanded
              ? group.options
              : group.options.filter((option, index) => index < ROWS_BEFORE_MORE || important.includes(option));
            const hidden = group.options.length - visible.length;
            return (
              <section className="v2-configure-option-group" key={group.key}>
                <h3>
                  <button
                    aria-expanded={open}
                    onClick={() => setOpenGroup(open ? "" : group.key)}
                    type="button"
                  >
                    <span>{group.name}</span>
                    <span>{group.options.length}</span>
                  </button>
                </h3>
                {open ? (
                  <div>
                    {visible.map((option) => (
                      <ConfigureOption
                        component={selectedComponent ?? undefined}
                        disabled={disabled}
                        draft={draft}
                        issues={issues.filter((issue) => !issue.scope || issue.scope === selectedComponent?.componentId)}
                        key={option.key}
                        onChoice={onChoice}
                        onReset={onReset}
                        onValue={onValue}
                        option={option}
                        scope={scope}
                      />
                    ))}
                    {hidden > 0 ? (
                      <Button
                        onClick={() => setExpandedGroups((current) => new Set(current).add(group.key))}
                        variant="ghost"
                      >
                        {hidden} more
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </section>
            );
          })}

          {!groups.length ? (
            <p className="v2-configure-muted">No options are available for this scope or search.</p>
          ) : null}

          {mode === "custom" && !selectedComponent ? (
            <section className="v2-configure-inspector-section">
              <h3>Parts</h3>
              {components.length ? (
                <ul className="v2-configure-parts">
                  {components.map((component) => (
                    <li key={component.componentId}>
                      <button onClick={() => onSelectComponent(component.componentId)} type="button">
                        <span>{component.label}</span>
                        <small>{Math.round(component.rect.w)} × {Math.round(component.rect.h)} mm</small>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : <p className="v2-configure-muted">Parts appear after the first successful resolve.</p>}
            </section>
          ) : null}

          {mode === "custom" && (draft.topologyEdits?.length ?? 0) > 0 ? (
            <section className="v2-configure-inspector-section">
              <h3>Structural changes</h3>
              <ol className="v2-configure-history">
                {draft.topologyEdits!.map((entry) => {
                  const target = components.find((component) => component.componentId === entry.edit.componentId)?.label;
                  const label = describeEdit(entry.edit, target);
                  return (
                    <li key={entry.id}>
                      <span>{label}</span>
                      <Button disabled={disabled} onClick={() => onRemoveEdit(entry.id)} variant="ghost">Undo</Button>
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
