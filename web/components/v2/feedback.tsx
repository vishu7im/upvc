import type { ReactNode } from "react";
import { Button, ButtonLink } from "./button";
import { V2Icon, type V2IconName } from "./icons";

export type FeedbackTone = "neutral" | "success" | "warning" | "error";

export function Alert({
  title,
  children,
  tone = "neutral",
}: {
  title: string;
  children: ReactNode;
  tone?: FeedbackTone;
}) {
  const icon: V2IconName = tone === "success" ? "check" : tone === "warning" || tone === "error" ? "warning" : "info";
  return (
    <div className="v2-alert" data-v2-tone={tone} role={tone === "error" ? "alert" : "status"}>
      <V2Icon name={icon} />
      <div>
        <strong>{title}</strong>
        <div>{children}</div>
      </div>
    </div>
  );
}

export interface StateAction {
  label: string;
  href?: string;
  onSelect?: () => void;
}

export function EmptyState({
  title,
  description,
  action,
  icon = "empty",
}: {
  title: string;
  description: string;
  action?: StateAction;
  icon?: V2IconName;
}) {
  return (
    <div className="v2-empty-state">
      <span className="v2-empty-state-icon" aria-hidden="true">
        <V2Icon name={icon} />
      </span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {action?.href ? <ButtonLink href={action.href}>{action.label}</ButtonLink> : action?.onSelect ? <Button onClick={action.onSelect}>{action.label}</Button> : null}
    </div>
  );
}

export function ErrorState({
  title,
  description,
  recovery,
}: {
  title: string;
  description: string;
  recovery: StateAction;
}) {
  return (
    <div className="v2-error-state" role="alert">
      <V2Icon name="warning" />
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {recovery.href ? <ButtonLink href={recovery.href} variant="secondary">{recovery.label}</ButtonLink> : recovery.onSelect ? <Button icon="retry" onClick={recovery.onSelect} variant="secondary">{recovery.label}</Button> : null}
    </div>
  );
}

export function Skeleton({ shape = "text" }: { shape?: "text" | "block" | "row" | "circle" }) {
  return <span aria-hidden="true" className="v2-skeleton" data-v2-skeleton={shape} />;
}

export function LoadingState({ label = "Loading", rows = 3 }: { label?: string; rows?: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <div aria-busy="true" aria-label={label} className="v2-loading-state" role="status">
      <span className="v2-visually-hidden">{label}</span>
      {Array.from({ length: rows }, (_, index) => <Skeleton key={index} shape="row" />)}
    </div>
  );
}

export type ContentStatus =
  | { status?: "ready" }
  | { status: "loading"; label?: string }
  | { status: "empty"; title: string; description: string; action?: StateAction }
  | { status: "error"; title: string; description: string; recovery: StateAction };

export function ContentState({ state, children }: { state: ContentStatus; children: ReactNode }) {
  if (state.status === "loading") return <LoadingState label={state.label} />;
  if (state.status === "empty") return <EmptyState action={state.action} description={state.description} title={state.title} />;
  if (state.status === "error") return <ErrorState description={state.description} recovery={state.recovery} title={state.title} />;
  return children;
}
