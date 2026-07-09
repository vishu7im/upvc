"use client";

// =====================================================================
// Permission-grid editor (Client Component, PLAN §7.3). Rows = modules grouped
// by category, columns = actions, per-module OWN/ALL scope select (shown once
// `read` is granted). Enforces the dependency rules (§4.4: create/update/delete
// require read) and DISABLES any cell the actor doesn't personally hold — the
// client mirror of assertGrantable. The server re-checks every tuple on save.
// =====================================================================

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ApiError, updateRolePermissions } from "@/lib/api";
import type { GridTuple, MetaPermissions, PermissionsMap } from "@/lib/types";
import {
  Button,
  Card,
  cn,
  selectClass,
} from "@/components/ui";

type Scope = "OWN" | "ALL";
interface ModuleState {
  actions: Set<string>;
  scope: Scope;
}
const DEPENDENT = new Set(["create", "update", "delete"]); // require read

export default function GridEditor({
  roleId,
  modules,
  actions,
  initial,
  actor,
}: {
  roleId: string;
  modules: MetaPermissions["modules"];
  actions: MetaPermissions["actions"];
  initial: GridTuple[];
  actor: { isSuperAdmin: boolean; permissions: PermissionsMap };
}) {
  const router = useRouter();

  const [grid, setGrid] = useState<Map<string, ModuleState>>(() => {
    const m = new Map<string, ModuleState>();
    for (const t of initial) {
      let e = m.get(t.module);
      if (!e) {
        e = { actions: new Set(), scope: t.scope };
        m.set(t.module, e);
      }
      e.actions.add(t.action);
      if (t.scope === "OWN") e.scope = "OWN"; // OWN wins (mirrors the resolver)
    }
    return m;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  // Can the actor grant (module, action)? Super Admin: always.
  function actorHolds(module: string, action: string): boolean {
    if (actor.isSuperAdmin) return true;
    return actor.permissions[module]?.actions.includes(action) ?? false;
  }
  function actorHoldsAll(module: string): boolean {
    if (actor.isSuperAdmin) return true;
    return actor.permissions[module]?.scope === "ALL";
  }

  const grouped = useMemo(() => {
    const byCat = new Map<string, MetaPermissions["modules"]>();
    for (const mod of modules) {
      const cat = mod.category ?? "Other";
      const arr = byCat.get(cat) ?? [];
      arr.push(mod);
      byCat.set(cat, arr);
    }
    return [...byCat.entries()];
  }, [modules]);

  function toggle(module: string, action: string) {
    setOk(false);
    setGrid((prev) => {
      const next = new Map(prev);
      const cur = next.get(module);
      const acts = new Set(cur?.actions ?? []);
      const scope: Scope = cur?.scope ?? (actorHoldsAll(module) ? "ALL" : "OWN");
      if (acts.has(action)) {
        acts.delete(action);
        // Removing read cascades to the actions that depend on it.
        if (action === "read") for (const d of DEPENDENT) acts.delete(d);
      } else {
        acts.add(action);
        // Granting a dependent action implies read.
        if (DEPENDENT.has(action)) acts.add("read");
      }
      if (acts.size === 0) next.delete(module);
      else next.set(module, { actions: acts, scope });
      return next;
    });
  }

  function setScope(module: string, scope: Scope) {
    setOk(false);
    setGrid((prev) => {
      const next = new Map(prev);
      const cur = next.get(module);
      if (cur) next.set(module, { actions: cur.actions, scope });
      return next;
    });
  }

  async function save() {
    setError(null);
    setOk(false);
    setSaving(true);
    const tuples: GridTuple[] = [];
    for (const [module, state] of grid) {
      for (const action of state.actions) tuples.push({ module, action, scope: state.scope });
    }
    try {
      await updateRolePermissions(roleId, tuples);
      setOk(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {ok && <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Permissions saved. Changes apply on each affected user&apos;s next request.</p>}

      {grouped.map(([category, mods]) => (
        <Card key={category} className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-950">{category}</h2>
            <span className="text-xs font-medium text-slate-500">{mods.length} {mods.length === 1 ? "module" : "modules"}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 min-w-52 border-b border-r border-slate-200 bg-slate-50 px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">Module</th>
                  {actions.map((a) => (
                    <th key={a.slug} className="min-w-24 border-b border-slate-200 bg-slate-50 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-500">{a.name}</th>
                  ))}
                  <th className="min-w-36 border-b border-slate-200 bg-slate-50 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-500">Data scope</th>
                </tr>
              </thead>
              <tbody>
                {mods.map((mod) => {
                  const state = grid.get(mod.slug);
                  const hasRead = state?.actions.has("read") ?? false;
                  return (
                    <tr key={mod.slug}>
                      <td className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-5 py-4 font-semibold text-slate-900">{mod.name}</td>
                      {actions.map((a) => {
                        const checked = state?.actions.has(a.slug) ?? false;
                        const editable = actorHolds(mod.slug, a.slug);
                        return (
                          <td key={a.slug} className={cn("border-b border-slate-100 px-3 py-4 text-center", !editable && "bg-slate-100/90")}>
                            <span className={cn("mx-auto flex h-9 w-9 items-center justify-center rounded-md border", editable ? "border-slate-200 bg-white" : "border-slate-300 bg-slate-200")}>
                              <input
                                type="checkbox"
                                className="h-5 w-5 cursor-pointer accent-[#4442e3] disabled:cursor-not-allowed disabled:accent-slate-400"
                                checked={checked}
                                disabled={!editable}
                                title={editable ? undefined : "You don't hold this permission"}
                                onChange={() => toggle(mod.slug, a.slug)}
                              />
                            </span>
                          </td>
                        );
                      })}
                      <td className={cn("border-b border-slate-100 px-3 py-4 text-center", !hasRead && "bg-slate-100/90")}>
                        <select
                          className={cn(selectClass, "mx-auto h-9 w-28 disabled:border-slate-300 disabled:bg-slate-200")}
                          value={state?.scope ?? "ALL"}
                          disabled={!hasRead}
                          onChange={(e) => setScope(mod.slug, e.target.value as Scope)}
                        >
                          <option value="OWN">Own</option>
                          <option value="ALL" disabled={!actorHoldsAll(mod.slug)}>All</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ))}

      <div className="flex items-center gap-3">
        <Button icon="check" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save permissions"}
        </Button>
      </div>
    </div>
  );
}
