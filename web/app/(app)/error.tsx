"use client";

// Error boundary for the protected shell. Catches render/fetch errors (e.g.
// the engine returning 500, or being unreachable on a server fetch) and offers
// a retry instead of a blank screen.

import { Button } from "@/components/ui";
import { Icon } from "@/components/icons";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="max-w-xl rounded-lg border border-amber-200 bg-white p-8 text-center shadow-[0_22px_60px_rgba(15,23,42,0.08)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-md bg-amber-50 text-amber-700">
          <Icon name="alert" className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-2xl font-bold text-slate-950">Something went wrong</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {error.message || "An unexpected error occurred. The engine API may be unreachable."}
        </p>
        <Button onClick={reset} className="mt-6">
          Try again
        </Button>
      </div>
    </div>
  );
}
