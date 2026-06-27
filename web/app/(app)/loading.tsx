// Shared loading skeleton for route transitions within the protected shell.
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-4 w-40 rounded bg-[#e7e6ff]" />
      <div className="mt-3 h-10 w-80 rounded bg-slate-200" />
      <div className="mt-3 h-4 w-[28rem] max-w-full rounded bg-slate-100" />
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-36 rounded-lg" />
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="skeleton h-96 rounded-lg" />
        <div className="space-y-4">
          <div className="skeleton h-48 rounded-lg" />
          <div className="skeleton h-40 rounded-lg" />
        </div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-40 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
