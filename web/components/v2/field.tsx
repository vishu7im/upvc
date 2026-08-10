import { useId } from "react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { ControlStateBoundary, type ControlStateProps } from "./state";

type SharedFieldProps = ControlStateProps & {
  label: string;
  hint?: string;
  required?: boolean;
  unit?: string;
};

type SafeInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className" | "style" | "size" | "required" | "children" | "type" | "onReset" | "height" | "width" | "color"
>;

export type TextFieldProps = SharedFieldProps & SafeInputProps & {
  type?: "text" | "email" | "search" | "tel" | "url" | "password" | "number";
};

function FieldFrame({
  children,
  inputId,
  hint,
  label,
  messageId,
  required,
  unit,
  stateProps,
}: {
  children: ReactNode;
  inputId: string;
  hint?: string;
  label: string;
  messageId: string;
  required?: boolean;
  unit?: string;
  stateProps: ControlStateProps;
}) {
  return (
    <ControlStateBoundary messageId={messageId} stateProps={stateProps}>
      <label className="v2-field-label" htmlFor={inputId}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
        {required ? <span className="v2-visually-hidden"> required</span> : null}
        {unit ? <span className="v2-visually-hidden"> in {unit}</span> : null}
      </label>
      {children}
      {hint ? <p className="v2-field-hint" id={`${inputId}-hint`}>{hint}</p> : null}
    </ControlStateBoundary>
  );
}

function describedBy(inputId: string, hint: string | undefined, state: ControlStateProps): string | undefined {
  const ids = [];
  if (hint) ids.push(`${inputId}-hint`);
  if (state.state && state.state !== "default") ids.push(`${inputId}-state`);
  return ids.length ? ids.join(" ") : undefined;
}

export function TextField({
  label,
  hint,
  required,
  unit,
  state = "default",
  stateMessage,
  onReset,
  id,
  type = "text",
  ...inputProps
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const stateProps = { state, stateMessage, onReset } as ControlStateProps;
  const messageId = `${inputId}-state`;
  return (
    <FieldFrame hint={hint} inputId={inputId} label={label} messageId={messageId} required={required} stateProps={stateProps} unit={unit}>
      <span className="v2-field-control">
        <input
          {...inputProps}
          aria-describedby={describedBy(inputId, hint, stateProps)}
          aria-invalid={state === "error" || undefined}
          id={inputId}
          required={required}
          type={type}
        />
        {unit ? <span className="v2-field-unit" aria-hidden="true">{unit}</span> : null}
      </span>
    </FieldFrame>
  );
}

type SafeSelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "className" | "style" | "size" | "required" | "children" | "onReset"
>;

export type SelectFieldProps = Omit<SharedFieldProps, "unit"> & SafeSelectProps & {
  options: ReadonlyArray<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
};

export function SelectField({
  label,
  hint,
  required,
  state = "default",
  stateMessage,
  onReset,
  id,
  options,
  placeholder,
  ...selectProps
}: SelectFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const stateProps = { state, stateMessage, onReset } as ControlStateProps;
  return (
    <FieldFrame hint={hint} inputId={inputId} label={label} messageId={`${inputId}-state`} required={required} stateProps={stateProps}>
      <select
        {...selectProps}
        aria-describedby={describedBy(inputId, hint, stateProps)}
        aria-invalid={state === "error" || undefined}
        id={inputId}
        required={required}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => <option disabled={option.disabled} key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </FieldFrame>
  );
}

type SafeTextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "className" | "style" | "required" | "children" | "onReset"
>;

export type TextAreaFieldProps = Omit<SharedFieldProps, "unit"> & SafeTextareaProps;

export function TextAreaField({
  label,
  hint,
  required,
  state = "default",
  stateMessage,
  onReset,
  id,
  ...textareaProps
}: TextAreaFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const stateProps = { state, stateMessage, onReset } as ControlStateProps;
  return (
    <FieldFrame hint={hint} inputId={inputId} label={label} messageId={`${inputId}-state`} required={required} stateProps={stateProps}>
      <textarea
        {...textareaProps}
        aria-describedby={describedBy(inputId, hint, stateProps)}
        aria-invalid={state === "error" || undefined}
        id={inputId}
        required={required}
      />
    </FieldFrame>
  );
}

type SafeCheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className" | "style" | "size" | "type" | "required" | "children" | "onReset" | "height" | "width" | "color"
>;

export function CheckboxField({
  label,
  hint,
  required,
  state = "default",
  stateMessage,
  onReset,
  id,
  ...inputProps
}: Omit<SharedFieldProps, "unit"> & SafeCheckboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const stateProps = { state, stateMessage, onReset } as ControlStateProps;
  return (
    <ControlStateBoundary messageId={`${inputId}-state`} stateProps={stateProps}>
      <label className="v2-checkbox-field" htmlFor={inputId}>
        <input
          {...inputProps}
          aria-describedby={describedBy(inputId, hint, stateProps)}
          aria-invalid={state === "error" || undefined}
          id={inputId}
          required={required}
          type="checkbox"
        />
        <span>
          {label}{required ? " *" : ""}
          {hint ? <small id={`${inputId}-hint`}>{hint}</small> : null}
        </span>
      </label>
    </ControlStateBoundary>
  );
}
