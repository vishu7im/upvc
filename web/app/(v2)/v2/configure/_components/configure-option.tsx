"use client";

import { ControlStateBoundary, type ControlStateProps } from "@/components/v2";
import {
  effectiveAnswer,
  isAnswered,
  type EffectiveAnswer,
} from "@/lib/designer-draft";
import type { LineItemDraft, LineItemIssue, OptionChoice, OptionDef } from "@/lib/types";

function imageSource(choice: OptionChoice): string | null {
  if (!choice.image?.ref) return null;
  if (choice.image.kind === "url") return choice.image.ref;
  if (choice.image.kind === "catalog-asset") return `/api/catalog/assets/${choice.image.ref}`;
  return null;
}

function stateFor(
  option: OptionDef,
  answer: EffectiveAnswer,
  issues: ReadonlyArray<LineItemIssue>,
  onReset: () => void,
): ControlStateProps {
  const ownIssues = issues.filter((issue) => issue.optionKey === option.key);
  const error = ownIssues.find((issue) => issue.severity === "error");
  if (error) return { state: "error", stateMessage: error.message };
  const warning = ownIssues[0];
  if (warning) return { state: "attention", stateMessage: warning.message };
  if (option.required && answer.source === "unset") {
    return { state: "attention", stateMessage: "Choose an answer before saving this item." };
  }
  if (isAnswered(answer)) {
    return {
      state: "changed",
      stateMessage: "This answer overrides the catalog default.",
      onReset,
    };
  }
  return { state: "default" };
}

export function ConfigureOption({
  component,
  disabled,
  draft,
  issues,
  onChoice,
  onReset,
  onValue,
  option,
  scope,
}: {
  component?: Parameters<typeof effectiveAnswer>[2];
  disabled?: boolean;
  draft: LineItemDraft;
  issues: ReadonlyArray<LineItemIssue>;
  onChoice: (option: OptionDef, choiceKey: string, scope?: string) => void;
  onReset: (option: OptionDef, scope?: string) => void;
  onValue: (option: OptionDef, value: string | number, scope?: string) => void;
  option: OptionDef;
  scope?: string;
}) {
  const answer = effectiveAnswer(draft, option, component);
  const inputId = `v2-config-${option.key}`;
  const state = stateFor(option, answer, issues, () => onReset(option, scope));
  const choices = option.choices;

  let control: React.ReactNode;
  if (option.display === "number") {
    control = (
      <input
        disabled={disabled}
        id={inputId}
        max={option.validation?.max}
        min={option.validation?.min}
        onChange={(event) => onValue(
          option,
          event.target.value === "" ? "" : Number(event.target.value),
          scope,
        )}
        type="number"
        value={answer.value === undefined ? "" : String(answer.value)}
      />
    );
  } else if (option.display === "text") {
    const listId = `${inputId}-suggestions`;
    const suggestions = option.presentation?.suggestions ?? [];
    control = (
      <>
        <input
          disabled={disabled}
          id={inputId}
          list={suggestions.length ? listId : undefined}
          maxLength={option.validation?.maxLength}
          onChange={(event) => onValue(option, event.target.value, scope)}
          type="text"
          value={answer.value === undefined ? "" : String(answer.value)}
        />
        {suggestions.length ? (
          <datalist id={listId}>
            {suggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}
          </datalist>
        ) : null}
      </>
    );
  } else if (option.display === "toggle" && choices.length === 2) {
    const active = answer.choice?.key === choices[1]?.key;
    control = (
      <button
        aria-checked={active}
        className="v2-configure-toggle"
        disabled={disabled}
        id={inputId}
        onClick={() => onChoice(option, active ? choices[0]!.key : choices[1]!.key, scope)}
        role="switch"
        type="button"
      >
        <span>{(active ? choices[1] : choices[0])?.label}</span>
        <span aria-hidden="true" data-v2-active={active || undefined} />
      </button>
    );
  } else if (option.display === "select-image") {
    control = (
      <div aria-label={option.name} className="v2-configure-image-choices" id={inputId} role="radiogroup">
        {choices.map((choice) => {
          const source = imageSource(choice);
          const active = answer.choice?.key === choice.key;
          return (
            <button
              aria-checked={active}
              data-v2-active={active || undefined}
              disabled={disabled}
              key={choice.key}
              onClick={() => onChoice(option, choice.key, scope)}
              role="radio"
              type="button"
            >
              {source ? (
                // eslint-disable-next-line @next/next/no-img-element -- authenticated catalog asset route
                <img alt="" aria-hidden="true" loading="lazy" src={source} />
              ) : null}
              <span>{choice.label}</span>
            </button>
          );
        })}
      </div>
    );
  } else if (option.display === "segmented" || choices.length <= 4) {
    control = (
      <div aria-label={option.name} className="v2-configure-segments" id={inputId} role="radiogroup">
        {choices.map((choice) => {
          const active = answer.choice?.key === choice.key;
          return (
            <button
              aria-checked={active}
              data-v2-active={active || undefined}
              disabled={disabled}
              key={choice.key}
              onClick={() => onChoice(option, choice.key, scope)}
              role="radio"
              type="button"
            >
              {choice.label}
            </button>
          );
        })}
      </div>
    );
  } else {
    control = (
      <select
        disabled={disabled}
        id={inputId}
        onChange={(event) => onChoice(option, event.target.value, scope)}
        value={answer.choice?.key ?? ""}
      >
        {!answer.choice ? <option value="">Not selected</option> : null}
        {choices.map((choice) => (
          <option key={choice.key} value={choice.key}>{choice.label}</option>
        ))}
      </select>
    );
  }

  return (
    <ControlStateBoundary messageId={`${inputId}-state`} stateProps={state}>
      <div className="v2-configure-option-heading">
        <label htmlFor={inputId}>
          {option.name}{option.required ? <span aria-hidden="true"> *</span> : null}
        </label>
        {option.pricingMode === "none" ? <small>Specification only</small> : null}
        {option.presentation?.helpText ? (
          <details>
            <summary aria-label={`About ${option.name}`}>i</summary>
            <p>{option.presentation.helpText}</p>
          </details>
        ) : null}
      </div>
      {control}
    </ControlStateBoundary>
  );
}
