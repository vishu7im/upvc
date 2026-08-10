/** View-only helpers for the V2 presentation layer. */

export function initials(label: string, fallback = "?"): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase() ?? "")
    .join("");
}

export function displayText(value: string | null | undefined, fallback = "Not provided"): string {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}
