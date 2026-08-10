import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { V2Icon, type V2IconName } from "./icons";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className" | "style" | "children"
>;

export interface ButtonProps extends NativeButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  icon?: V2IconName;
  loading?: boolean;
  loadingLabel?: string;
}

export function Button({
  children,
  variant = "primary",
  icon,
  loading = false,
  loadingLabel = "Working",
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      aria-busy={loading || undefined}
      className="v2-button"
      data-v2-variant={variant}
      disabled={disabled || loading}
      type={type}
    >
      {loading ? <span aria-hidden="true" className="v2-progress-dot" /> : icon ? <V2Icon name={icon} /> : null}
      <span>{loading ? loadingLabel : children}</span>
    </button>
  );
}

export interface ButtonLinkProps {
  children: ReactNode;
  href: string;
  variant?: Exclude<ButtonVariant, "danger">;
  icon?: V2IconName;
  download?: boolean | string;
}

export function ButtonLink({ children, href, variant = "primary", icon, download }: ButtonLinkProps) {
  return (
    <Link
      className="v2-button"
      data-v2-variant={variant}
      download={download}
      href={href}
      prefetch={href.startsWith("/api/") ? false : undefined}
    >
      {icon ? <V2Icon name={icon} /> : null}
      <span>{children}</span>
    </Link>
  );
}

type IconButtonProps = Omit<NativeButtonProps, "aria-label" | "title"> & {
  label: string;
  icon: V2IconName;
  tooltip: string;
};

export function IconButton({ label, icon, tooltip, type = "button", ...props }: IconButtonProps) {
  return (
    <button {...props} aria-label={label} className="v2-icon-button" title={tooltip} type={type}>
      <V2Icon name={icon} />
    </button>
  );
}
