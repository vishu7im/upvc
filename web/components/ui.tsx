import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export const fieldClass =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 transition placeholder:text-slate-400 focus:border-[#4442e3] focus:ring-[3px] focus:ring-[#4442e3]/12 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

export const selectClass = cn(fieldClass, "appearance-none pr-9");

/**
 * The one micro-label treatment. It used to be re-declared inline in a dozen
 * files, which is how three slightly different greys and two sizes ended up on
 * the same screen.
 */
export const labelClass = "text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500";

export const tableWrapClass =
  "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[var(--shadow-xs)]";

export const tableClass = "w-full border-collapse text-sm";

export const thClass =
  "border-b border-slate-200 bg-slate-50/70 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500";

export const tdClass = "border-b border-slate-100 px-4 py-3 align-middle text-slate-700";

export function buttonClasses(variant: "primary" | "secondary" | "ghost" | "success" | "danger" = "primary") {
  const base =
    "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50";
  const variants = {
    primary: "bg-[#0f172a] text-white shadow-[var(--shadow-xs)] hover:bg-[#1e293b] focus-visible:ring-slate-300",
    secondary:
      "border border-slate-200 bg-white text-slate-800 shadow-[var(--shadow-xs)] hover:bg-slate-50 focus-visible:ring-slate-200",
    ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-slate-200",
    success: "bg-emerald-600 text-white shadow-[var(--shadow-xs)] hover:bg-emerald-500 focus-visible:ring-emerald-200",
    danger: "bg-red-600 text-white hover:bg-red-500 focus-visible:ring-red-200",
  };
  return cn(base, variants[variant]);
}

export function Button({
  variant = "primary",
  className,
  icon,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "success" | "danger";
  icon?: IconName;
}) {
  return (
    <button className={cn(buttonClasses(variant), className)} {...props}>
      {icon && <Icon name={icon} className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  className,
  icon,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: "primary" | "secondary" | "ghost" | "success" | "danger";
  icon?: IconName;
}) {
  return (
    <Link className={cn(buttonClasses(variant), className)} {...props}>
      {icon && <Icon name={icon} className="h-4 w-4" />}
      {children}
    </Link>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn("rounded-xl border border-slate-200 bg-white shadow-[var(--shadow-xs)]", className)}
    >
      {children}
    </section>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && <p className={cn("mb-2 text-[#4442e3]", labelClass)}>{eyebrow}</p>}
        <h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>}
        {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Badge({
  children,
  tone = "slate",
  className,
}: {
  children: ReactNode;
  tone?: "slate" | "blue" | "green" | "amber" | "red" | "purple";
  className?: string;
}) {
  const tones = {
    slate: "bg-slate-100 text-slate-600 ring-slate-200/70",
    blue: "bg-blue-50 text-blue-700 ring-blue-200/70",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
    amber: "bg-amber-50 text-amber-700 ring-amber-200/70",
    red: "bg-red-50 text-red-700 ring-red-200/70",
    purple: "bg-[#eeedff] text-[#4442e3] ring-[#d6d4ff]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Alert({
  tone = "amber",
  title,
  children,
}: {
  tone?: "amber" | "red" | "green" | "blue";
  title: string;
  children?: ReactNode;
}) {
  const tones = {
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-red-200 bg-red-50 text-red-900",
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
  };
  return (
    <div className={cn("rounded-xl border p-3.5 text-sm", tones[tone])}>
      <div className="flex gap-3">
        <Icon name={tone === "green" ? "check" : "alert"} className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-semibold">{title}</p>
          {children && <div className="mt-1 leading-6 opacity-85">{children}</div>}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  icon = "box",
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className="rounded-xl border border-dashed bg-white px-6 py-12 text-center"
      style={{ borderColor: "var(--border-strong)" }}
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon name={icon} className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-950">{title}</h2>
      {description && <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  delta,
  icon,
  tone = "blue",
}: {
  label: string;
  value: ReactNode;
  delta?: string;
  icon: IconName;
  tone?: "blue" | "green" | "amber" | "red" | "slate";
}) {
  const tones = {
    blue: "bg-[#eeedff] text-[#4442e3]",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", tones[tone])}>
          <Icon name={icon} className="h-4 w-4" />
        </div>
        <p className={cn("min-w-0 truncate", labelClass)}>{label}</p>
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
      {delta && <p className="mt-1 text-xs font-semibold text-slate-500">{delta}</p>}
    </Card>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className={cn("mb-1.5 block", labelClass)}>{children}</span>;
}
