// Global 404 (e.g. an unknown product/order id calling notFound()).
import Link from "next/link";
import { Icon } from "@/components/icons";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center bg-[#f6f8fb] px-4 py-20 text-center">
      <div className="max-w-lg rounded-lg border border-slate-200 bg-white p-8 shadow-[0_22px_60px_rgba(15,23,42,0.08)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-md bg-slate-100 text-slate-600">
          <Icon name="document" className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-3xl font-bold text-slate-950">404</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">That page or record does not exist.</p>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-[#0f172a] px-4 text-sm font-semibold text-white transition hover:bg-[#172033]"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
