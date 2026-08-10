export type StatusTone = "neutral" | "success" | "warning" | "error";

export function StatusChip({ label, tone = "neutral" }: { label: string; tone?: StatusTone }) {
  return (
    <span className="v2-status-chip" data-v2-tone={tone}>
      <span aria-hidden="true" className="v2-status-mark" />
      {label}
    </span>
  );
}
