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
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase text-slate-500">{category}</div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">Module</th>
                  {actions.map((a) => (
                    <th key={a.slug} className="px-3 py-2.5 text-center text-xs font-semibold uppercase text-slate-500">{a.name}</th>
                  ))}
                  <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase text-slate-500">Data scope</th>
                </tr>
              </thead>
              <tbody>
                {mods.map((mod) => {
                  const state = grid.get(mod.slug);
                  const hasRead = state?.actions.has("read") ?? false;
                  return (
                    <tr key={mod.slug} className="border-t border-slate-100">
                      <td className="px-4 py-2.5 font-semibold text-slate-800">{mod.name}</td>
                      {actions.map((a) => {
                        const checked = state?.actions.has(a.slug) ?? false;
                        const editable = actorHolds(mod.slug, a.slug);
                        return (
                          <td key={a.slug} className="px-3 py-2.5 text-center">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-[#4442e3] disabled:opacity-40"
                              checked={checked}
                              disabled={!editable}
                              title={editable ? undefined : "You don't hold this permission"}
                              onChange={() => toggle(mod.slug, a.slug)}
                            />
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-center">
                        <select
                          className={cn(selectClass, "mx-auto h-9 w-28")}
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
        <span className="text-xs text-slate-500">Create / Update / Delete require Read.</span>
      </div>
    </div>
  );
}
