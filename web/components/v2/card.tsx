import type { ReactNode } from "react";
import { ContentState, type ContentStatus } from "./feedback";
import type { V2IconName } from "./icons";
import { V2Icon } from "./icons";

export function Card({
  children,
  title,
  description,
  actions,
  elevation = "raised",
  state = { status: "ready" },
}: {
  children: ReactNode;
  title?: string;
  description?: string;
  actions?: ReactNode;
  elevation?: "flat" | "raised";
  state?: ContentStatus;
}) {
  return (
    <section className="v2-card" data-v2-elevation={elevation === "raised" ? "1" : "0"}>
      {title ? (
        <div className="v2-card-heading">
          <div>
            <h3>{title}</h3>
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className="v2-heading-actions">{actions}</div> : null}
        </div>
      ) : null}
      <ContentState state={state}>{children}</ContentState>
    </section>
  );
}

export function MetricCard({
  label,
  value,
  context,
  icon,
  state = { status: "ready" },
}: {
  label: string;
  value: ReactNode;
  context?: string;
  icon?: V2IconName;
  state?: ContentStatus;
}) {
  return (
    <article className="v2-metric-card" data-v2-elevation="1">
      <ContentState state={state}>
        <div className="v2-metric-label">
          <span>{label}</span>
          {icon ? <V2Icon name={icon} /> : null}
        </div>
        <strong className="v2-metric-value">{value}</strong>
        {context ? <p>{context}</p> : null}
      </ContentState>
    </article>
  );
}
