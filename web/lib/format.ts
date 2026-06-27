// Shared display formatters for the web tier.

export function money(n: number | null | undefined, currency = "GBP"): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(n);
}

export function dateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** DocumentType enum (WORK_ORDER) → human label (Work Order). */
export function docLabel(type: string): string {
  return type
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
