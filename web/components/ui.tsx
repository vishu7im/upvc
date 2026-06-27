import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export const fieldClass =
  "h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 shadow-[0_1px_0_rgba(15,23,42,0.04)] transition placeholder:text-slate-400 focus:border-[#4442e3] focus:ring-4 focus:ring-[#4442e3]/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

export const selectClass = cn(fieldClass, "appearance-none pr-9");

export const tableWrapClass =
  "overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

export const tableClass = "w-full border-collapse text-sm";

export const thClass =
  "border-b border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500";

export const tdClass = "border-b border-slate-100 px-4 py-3 align-middle text-slate-700";

export function buttonClasses(variant: "primary" | "secondary" | "ghost" | "success" | "danger" = "primary") {
  const base =
    "inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition focus:ring-4 disabled:pointer-events-none disabled:opacity-55";
  const variants = {
    primary: "bg-[#0f172a] text-white shadow-[0_8px_20px_rgba(15,23,42,0.16)] hover:bg-[#172033] focus:ring-slate-300",
    secondary:
      "border border-slate-300 bg-white text-slate-800 shadow-[0_1px_1px_rgba(15,23,42,0.05)] hover:border-slate-400 hover:bg-slate-50 focus:ring-slate-200",
    ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus:ring-slate-200",
    success: "bg-emerald-600 text-white shadow-[0_8px_20px_rgba(16,185,129,0.18)] hover:bg-emerald-500 focus:ring-emerald-200",
    danger: "bg-red-600 text-white hover:bg-red-500 focus:ring-red-200",
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
      className={cn(
        "rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        className,
      )}
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
        {eyebrow && <p className="mb-2 text-xs font-semibold uppercase text-[#4442e3]">{eyebrow}</p>}
        <h1 className="text-3xl font-bold text-slate-950 sm:text-4xl">{title}</h1>
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
    <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
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
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    purple: "bg-[#e7e6ff] text-[#4442e3] ring-[#c7c5ff]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset",
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
    <div className={cn("rounded-lg border p-4 text-sm", tones[tone])}>
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
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
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
    blue: "bg-[#e7e6ff] text-[#4442e3] border-[#4442e3]",
    green: "bg-emerald-50 text-emerald-700 border-emerald-500",
    amber: "bg-amber-50 text-amber-700 border-amber-500",
    red: "bg-red-50 text-red-700 border-red-500",
    slate: "bg-slate-100 text-slate-700 border-slate-400",
  };
  return (
    <Card className="group relative overflow-hidden p-5 transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-md", tones[tone])}>
          <Icon name={icon} className="h-5 w-5" />
        </div>
        {delta && <span className="text-sm font-semibold text-emerald-600">{delta}</span>}
      </div>
      <p className="mt-5 text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
      <div className={cn("absolute inset-x-0 bottom-0 h-1 opacity-60 transition group-hover:opacity-100", tones[tone])} />
    </Card>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="mb-1.5 block text-xs font-semibold uppercase text-slate-600">{children}</span>;
}
