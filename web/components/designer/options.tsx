"use client";

// =====================================================================
// Inspector · Product tab — schema-driven rendering of the family's option
// system, for the CURRENT SCOPE (the whole item, or one selected part), plus
// the structural sections (parts, actions, history) that used to be a tab.
//
// There is deliberately NO option-specific code in this file: groups, order,
// labels, controls, defaults, filters and help text all come from
// GET /api/families/:key, so seeding a new option row makes it appear here
// correctly grouped and styled with no web/ change.
//
// PROGRESSIVE DISCLOSURE is the whole design. Everything is still reachable;
// what changed is how much of it is on screen at rest:
//   • ONE group open at a time (accordion) instead of every group at once.
//   • Inside a group, a row is shown when it is answered, required-and-unset,
//     carrying an issue, or among the first few in seed order. The rest sit
//     behind "N more" — and `pricingMode: "none"` rows (recorded on the spec,
//     no price, no BOM) always start there.
//   • ONE apply-scope control for the whole panel instead of a pair of pills
//     on every row.
// All three rules are structural, which is why no option key appears here.
//
// Scope (D4). With a part selected the tab shows the options that part can
// answer; the panel's scope control writes either the componentId or
// "<type>:*". The server's precedence ladder (select.ts) then decides the
// effective value — component > all-of-type > item > default — and this file
// only MIRRORS that ladder to show which rung answered.
// =====================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { cn, labelClass } from "@/components/ui";
import { Icon } from "@/components/icons";
import type {
  ApplyScope,
  ComponentRef,
  DraftTopologyEdit,
  FamilyDescriptor,
  LineItemDraft,
  LineItemIssue,
  OptionChoice,
  OptionDef,
  OptionGroupWithOptions,
} from "@/lib/types";
import {
  applyScopesFor,
  answerLabel,
  conversionTargets,
  effectiveAnswer,
  isAnswered,
  isLocationOption,
  optionAppliesTo,
  optionMatches,
  partitionGroup,
  scopeKeyFor,
} from "@/lib/designer-draft";
import { OptionControl, OptionRow, type OptionTone } from "./controls";
import { ComponentActions, EditHistory, PartsList } from "./structure";

/** How many rows of a group are shown before the "N more" disclosure. */
const ROWS_BEFORE_MORE = 3;

export interface OptionsTabProps {
  groups: OptionGroupWithOptions[];
  descriptor: FamilyDescriptor;
  draft: LineItemDraft;
  issues: LineItemIssue[];
  /** The selected component, or null for whole-item scope. */
  component: ComponentRef | null;
  components: ComponentRef[];
  onSelectComponent: (componentId: string | null) => void;
  /** Instant actions the selected component's type declares. */
  actions: OptionDef[];
  onAction: (option: OptionDef, atRatio?: number, choiceKey?: string) => void;
  edits: DraftTopologyEdit[];
  onRemoveEdit: (editId: string) => void;
  onChoice: (option: OptionDef, choiceKey: string, scope?: string) => void;
  onValue: (option: OptionDef, value: string | number, scope?: string) => void;
  onReset: (option: OptionDef, scope?: string) => void;
  /** Set by the Issues popover: expands the option's group and focuses it. */
  focusOptionKey?: string | null;
}

export default function OptionsTab({
  groups,
  descriptor,
  draft,
  issues,
  component,
  components,
  onSelectComponent,
  actions,
  onAction,
  edits,
  onRemoveEdit,
  onChoice,
  onValue,
  onReset,
  focusOptionKey,
}: OptionsTabProps) {
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const ordered = useMemo(() => [...groups].sort((a, b) => a.order - b.order), [groups]);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Scope 1 — what the selected part (or the item) can answer. The location
  // field is hoisted into Measurements, so it is excluded here.
  const partitions = useMemo(
    () =>
      ordered
        .map((g) => partitionGroup(g, { component, exclude: isLocationOption }))
        .filter((p) => p.answerable.length > 0),
    [ordered, component],
  );

  // Scope 2 — with a part selected, the remaining ITEM-level options stay
  // reachable underneath. Anything already answerable in the part scope above
  // is excluded, so no answer ever has two controls.
  const itemContext = useMemo(
    () =>
      component
        ? ordered
            .map((g) =>
              partitionGroup(g, {
                exclude: (o) => isLocationOption(o) || optionAppliesTo(o, component),
              }),
            )
            .filter((p) => p.answerable.length > 0)
        : [],
    [ordered, component],
  );

  const all = useMemo(() => [...partitions, ...itemContext], [partitions, itemContext]);

  // Accordion: exactly one group open. Seeded from the seed's own
  // `defaultCollapsed` (the first group that isn't collapsed), so which group
  // greets you stays catalog data.
  const firstOpen = ordered.find((g) => !g.defaultCollapsed)?.key ?? ordered[0]?.key ?? null;
  const [openKey, setOpenKey] = useState<string | null>(firstOpen);
  const [expandAll, setExpandAll] = useState(false);

  const matching = useMemo(() => {
    if (!query.trim()) return null;
    const out = new Map<string, OptionDef[]>();
    for (const p of all) {
      const hits = p.answerable.filter((o) => optionMatches(o, query));
      if (hits.length) out.set(p.group.key, [...(out.get(p.group.key) ?? []), ...hits]);
    }
    return out;
  }, [all, query]);

  // Deep-link from the issues popover: open the owning group during RENDER,
  // then scroll to and focus the control once that expansion has painted.
  const focusGroupKey = focusOptionKey
    ? all.find((p) => p.answerable.some((o) => o.key === focusOptionKey))?.group.key
    : undefined;

  useEffect(() => {
    if (!focusOptionKey) return;
    const id = window.setTimeout(() => {
      const el = rootRef.current?.querySelector<HTMLElement>(`#opt-${CSS.escape(focusOptionKey)}`);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      el?.focus({ preventScroll: true });
    }, 60);
    return () => window.clearTimeout(id);
  }, [focusOptionKey]);

  // ONE apply-scope for the whole panel. It is offered only when the selected
  // part actually has options that declare more than one scope.
  const panelScopes = useMemo(() => {
    const set = new Set<ApplyScope>();
    for (const p of partitions) for (const o of p.answerable) for (const s of applyScopesFor(o)) set.add(s);
    return [...set];
  }, [partitions]);
  const [panelScope, setPanelScope] = useState<ApplyScope>("this");
  // Selecting a different part starts from "this one" again — an "all sashes"
  // intent belongs to the part you set it on, not to the panel. Render-phase
  // reset per the React docs pattern; an effect here would cascade a second
  // render on every selection change.
  const [scopedTo, setScopedTo] = useState<string | null>(component?.componentId ?? null);
  if (scopedTo !== (component?.componentId ?? null)) {
    setScopedTo(component?.componentId ?? null);
    setPanelScope("this");
  }

  const renderGroup = (
    partition: (typeof partitions)[number],
    scopeComponent: ComponentRef | null,
    keyPrefix: string,
  ) => {
    const { group, answerable } = partition;
    const hits = matching?.get(group.key);
    if (matching && !hits) return null;
    const shown = matching ? answerable.filter((o) => hits!.includes(o)) : answerable;
    if (shown.length === 0) return null;
    const open = matching ? true : expandAll || openKey === group.key || group.key === focusGroupKey;

    const answers = answerable.map((o) => effectiveAnswer(draft, o, scopeComponent ?? undefined));
    const answered = answers.filter(isAnswered);
    const headline = answered.length ? answerLabel(answered[0]) : undefined;

    return (
      <GroupSection
        key={`${keyPrefix}${group.key}`}
        name={group.name}
        headline={headline}
        changed={answered.length}
        open={open}
        onToggle={() => {
          setExpandAll(false);
          setOpenKey((cur) => (cur === group.key ? null : group.key));
        }}
      >
        <OptionRows
          options={shown}
          disclose={!matching}
          keyPrefix={`${keyPrefix}${scopeComponent?.componentId ?? "item"}:`}
          descriptor={descriptor}
          draft={draft}
          issues={issues}
          component={scopeComponent}
          panelScope={panelScope}
          onChoice={onChoice}
          onValue={onValue}
          onReset={onReset}
        />
      </GroupSection>
    );
  };

  return (
    <div ref={rootRef} className="flex min-h-0 flex-1 flex-col">
      {/* ---- Scope header: what am I editing, and how wide does it apply --- */}
      <div className="border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-2">
          {component ? (
            <button
              type="button"
              onClick={() => onSelectComponent(null)}
              className="inline-flex min-w-0 items-center gap-1 rounded-full bg-[#eeedff] px-2.5 py-1 text-xs font-semibold text-[#4442e3] transition hover:bg-[#e2e0ff]"
              title="Back to the whole item"
            >
              <span className="truncate">{component.label}</span>
              <Icon name="x" className="h-3 w-3 shrink-0" />
            </button>
          ) : (
            <span className={cn("truncate", labelClass)}>Whole item</span>
          )}

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              aria-expanded={searchOpen}
              aria-label="Search options"
              className={cn(
                "rounded-md p-1.5 transition",
                searchOpen ? "bg-[#eeedff] text-[#4442e3]" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700",
              )}
            >
              <Icon name="search" className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setExpandAll((v) => !v);
                setOpenKey(null);
              }}
              className="rounded-md px-2 py-1 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            >
              {expandAll ? "Collapse" : "Expand all"}
            </button>
          </div>
        </div>

        {component && panelScopes.length > 1 && (
          <div
            role="radiogroup"
            aria-label="Apply answers to"
            className="mt-2 flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[11px] font-semibold"
          >
            {panelScopes.map((scope) => (
              <button
                key={scope}
                type="button"
                role="radio"
                aria-checked={panelScope === scope}
                onClick={() => setPanelScope(scope)}
                className={cn(
                  "flex-1 rounded-md px-2 py-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4442e3]/40",
                  panelScope === scope ? "bg-white text-slate-950 shadow-[var(--shadow-xs)]" : "text-slate-500 hover:text-slate-900",
                )}
              >
                {scope === "this" ? `This ${component.type}` : `All ${component.type}s`}
              </button>
            ))}
          </div>
        )}

        {searchOpen && (
          <div className="relative mt-2">
            <Icon
              name="search"
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search options"
              aria-label="Search options"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-sm focus:border-[#4442e3] focus:outline-none focus:ring-[3px] focus:ring-[#4442e3]/12"
            />
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Actions for the selected part sit at the top: they are the thing
            you most often came here to do after clicking a part. */}
        {component && actions.length > 0 && (
          <div className="border-b border-slate-200 bg-slate-50/60 px-4 py-2.5">
            <p className={cn("mb-1.5", labelClass)}>Actions</p>
            <ComponentActions
              actions={actions}
              frameMm={{
                widthMm: draft.dimensions.widthMm ?? 0,
                heightMm: draft.dimensions.heightMm ?? 0,
              }}
              onAction={onAction}
            />
          </div>
        )}

        {partitions.map((p) => renderGroup(p, component, ""))}

        {itemContext.length > 0 && (
          <>
            <p className={cn("border-y border-slate-200 bg-slate-50 px-4 py-1.5", labelClass)}>
              Whole item
            </p>
            {itemContext.map((p) => renderGroup(p, null, "item:"))}
          </>
        )}

        {matching && matching.size === 0 && (
          <p className="px-4 py-6 text-center text-sm text-slate-500">No options match “{query}”.</p>
        )}

        {/* Parts — the keyboard equivalent of clicking the drawing. Shown at
            item scope; once a part is selected the scope chip is the way back. */}
        {!component && !matching && (
          <GroupSection
            name="Parts"
            headline={components.length ? `${components.length}` : undefined}
            changed={0}
            open={openKey === "__parts__"}
            onToggle={() => {
              setExpandAll(false);
              setOpenKey((cur) => (cur === "__parts__" ? null : "__parts__"));
            }}
          >
            <PartsList
              components={components}
              selectedComponentId={null}
              onSelectComponent={onSelectComponent}
              issues={issues}
            />
          </GroupSection>
        )}

        {/* History appears only once there is something to undo. */}
        {edits.length > 0 && !matching && (
          <GroupSection
            name="Structural changes"
            headline={`${edits.length}`}
            changed={0}
            open={openKey === "__edits__"}
            onToggle={() => {
              setExpandAll(false);
              setOpenKey((cur) => (cur === "__edits__" ? null : "__edits__"));
            }}
          >
            <EditHistory
              edits={edits}
              components={components}
              issues={issues}
              onRemoveEdit={onRemoveEdit}
            />
          </GroupSection>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// One collapsible section
// ---------------------------------------------------------------------

function GroupSection({
  name,
  headline,
  changed,
  open,
  onToggle,
  children,
}: {
  name: string;
  headline?: string;
  changed: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-slate-200 last:border-b-0">
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex w-full items-center gap-2 px-4 py-3 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#4442e3]/40"
        >
          <Icon
            name="chevronRight"
            className={cn("h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform", open && "rotate-90")}
          />
          <span className="flex-1 truncate text-sm font-semibold text-slate-950">{name}</span>
          {headline && (
            <span
              className={cn(
                "max-w-[48%] truncate rounded-full px-2 py-0.5 text-[11px] font-semibold",
                changed > 0 ? "bg-[#eeedff] text-[#4442e3]" : "bg-slate-100 text-slate-500",
              )}
            >
              {headline}
              {changed > 1 ? ` +${changed - 1}` : ""}
            </span>
          )}
        </button>
      </h3>
      {open && <div className="bg-slate-50/40 pb-1">{children}</div>}
    </section>
  );
}

// ---------------------------------------------------------------------
// The rows of one group, with the "N more" disclosure
// ---------------------------------------------------------------------

function OptionRows({
  options,
  disclose,
  keyPrefix,
  descriptor,
  draft,
  issues,
  component,
  panelScope,
  onChoice,
  onValue,
  onReset,
}: {
  options: OptionDef[];
  /** False while searching — a search result must never be hidden behind "more". */
  disclose: boolean;
  keyPrefix: string;
  descriptor: FamilyDescriptor;
  draft: LineItemDraft;
  issues: LineItemIssue[];
  component: ComponentRef | null;
  panelScope: ApplyScope;
  onChoice: (option: OptionDef, choiceKey: string, scope?: string) => void;
  onValue: (option: OptionDef, value: string | number, scope?: string) => void;
  onReset: (option: OptionDef, scope?: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);

  /**
   * What earns a row a place at rest. Deliberately about the row's STATE, not
   * its identity: an option the user has touched, one that is blocking, or one
   * near the top of the seed order. Informational rows (no price, no BOM line)
   * are never promoted by position alone.
   */
  const primary = options.filter((option, index) => {
    const answer = effectiveAnswer(draft, option, component ?? undefined);
    if (isAnswered(answer)) return true;
    if (option.required && answer.source === "unset") return true;
    if (issues.some((i) => i.optionKey === option.key)) return true;
    if (option.pricingMode === "none") return false;
    return index < ROWS_BEFORE_MORE;
  });
  const hidden = options.filter((o) => !primary.includes(o));
  const visible = !disclose || showAll ? options : primary;

  return (
    <div className="divide-y divide-slate-100">
      {visible.map((option) => (
        <OptionField
          // Keyed by scope so switching parts remounts the row.
          key={`${keyPrefix}${option.key}`}
          option={option}
          descriptor={descriptor}
          draft={draft}
          issues={issues}
          component={component}
          panelScope={panelScope}
          onChoice={onChoice}
          onValue={onValue}
          onReset={onReset}
        />
      ))}
      {disclose && hidden.length > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="w-full px-4 py-2 text-left text-[11px] font-semibold text-slate-500 transition hover:text-[#4442e3]"
        >
          {showAll ? "Show less" : `${hidden.length} more ${hidden.length === 1 ? "option" : "options"}`}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// One option row
// ---------------------------------------------------------------------

function OptionField({
  option,
  descriptor,
  draft,
  issues,
  component,
  panelScope,
  onChoice,
  onValue,
  onReset,
}: {
  option: OptionDef;
  descriptor: FamilyDescriptor;
  draft: LineItemDraft;
  issues: LineItemIssue[];
  component: ComponentRef | null;
  panelScope: ApplyScope;
  onChoice: (option: OptionDef, choiceKey: string, scope?: string) => void;
  onValue: (option: OptionDef, value: string | number, scope?: string) => void;
  onReset: (option: OptionDef, scope?: string) => void;
}) {
  const answer = effectiveAnswer(draft, option, component ?? undefined);
  const scopes = applyScopesFor(option);
  // The panel's scope, narrowed to what this option actually offers — an option
  // that only applies one way is written that way whatever the panel says.
  const apply: ApplyScope = scopes.includes(panelScope) ? panelScope : scopes[0];

  const mine = issues.filter(
    (i) => i.optionKey === option.key && (!i.scope || !component || i.scope === component.componentId),
  );
  const tone: OptionTone = mine.some((i) => i.severity === "error")
    ? "error"
    : option.required && answer.source === "unset"
      ? "warning"
      : mine.length > 0
        ? "warning"
        : isAnswered(answer)
          ? "changed"
          : "default";

  const writeScope = component ? scopeKeyFor(component, apply) : undefined;

  return (
    <OptionRow
      option={option}
      tone={tone}
      issues={mine}
      badge={scopeBadge(answer.source, component)}
      onReset={isAnswered(answer) ? () => onReset(option, answer.scope) : undefined}
    >
      <OptionControl
        option={option}
        answer={answer}
        tone={tone}
        choices={legalChoices(option, descriptor, component)}
        onChoice={(choiceKey) => onChoice(option, choiceKey, writeScope)}
        onValue={(value) => onValue(option, value, writeScope)}
      />
    </OptionRow>
  );
}

/** "Override" / "All sashes" — which rung answered, when it isn't the plain one. */
function scopeBadge(source: string, component: ComponentRef | null): string | undefined {
  if (!component) return undefined;
  if (source === "component") return "This one";
  if (source === "all-of-type") return `All ${component.type}s`;
  if (source === "item") return "From item";
  return undefined;
}

/**
 * Choices the CURRENT selection may legally take. The only such rule today is
 * structural and comes from the family descriptor: a choice that converts the
 * component type is offered only for a conversion the descriptor declares (plus
 * the component's current type, which is the no-op "leave as is"). Recognised
 * by the choice's own engineEffect, so no option key appears here.
 */
function legalChoices(
  option: OptionDef,
  descriptor: FamilyDescriptor,
  component: ComponentRef | null,
): OptionChoice[] | undefined {
  if (!component) return undefined;
  const converts = option.choices.some(
    (c) => c.engineEffect?.kind === "topology-edit" && c.engineEffect.params?.op === "convert-component",
  );
  if (!converts) return undefined;
  const allowed = new Set<string>([component.type, ...conversionTargets(descriptor, component)]);
  return option.choices.filter((c) => {
    const to = c.engineEffect?.params?.to;
    return typeof to === "string" ? allowed.has(to) : true;
  });
}
