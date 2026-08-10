import type { ReactNode } from "react";

export function PageFrame({
  children,
  width = "detail",
}: {
  children: ReactNode;
  width?: "reading" | "detail" | "wide";
}) {
  return <main className="v2-page-frame" data-v2-frame={width}>{children}</main>;
}

export function PageHeading({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="v2-page-heading">
      <div>
        {eyebrow ? <p className="v2-eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="v2-lead">{description}</p> : null}
      </div>
      {actions ? <div className="v2-heading-actions">{actions}</div> : null}
    </header>
  );
}

export function Section({
  children,
  title,
  description,
  actions,
}: {
  children: ReactNode;
  title?: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <section className="v2-section">
      {title ? (
        <div className="v2-section-heading">
          <div>
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className="v2-heading-actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Stack({
  children,
  gap = "form",
}: {
  children: ReactNode;
  gap?: "related" | "form" | "card" | "section";
}) {
  return <div className="v2-stack" data-v2-gap={gap}>{children}</div>;
}

export function Cluster({ children }: { children: ReactNode }) {
  return <div className="v2-cluster">{children}</div>;
}

export function Grid({
  children,
  columns = "auto",
}: {
  children: ReactNode;
  columns?: "auto" | "two" | "three";
}) {
  return <div className="v2-grid" data-v2-columns={columns}>{children}</div>;
}
