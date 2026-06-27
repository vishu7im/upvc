// =====================================================================
// Section placeholder used by the U1 app shell for routes whose real screens
// land in later sub-milestones (U2–U5). Keeps the nav fully navigable now
// without 404s, and clearly flags what's coming.
// =====================================================================

export default function Placeholder({
  title,
  milestone,
  children,
}: {
  title: string;
  milestone: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="py-10">
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-xs font-semibold uppercase text-[#4442e3]">{milestone}</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {children ?? "Coming in a later sub-milestone."}
        </p>
      </div>
    </div>
  );
}
