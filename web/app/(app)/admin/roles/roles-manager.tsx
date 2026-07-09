"use client";

// =====================================================================
// Roles manager (Client Component). Lists roles with user counts; create a new
// role (name + optional description → navigate to its grid editor); delete a
// role (disabled + tooltip for system/in-use roles; surfaces the 409
// role_in_use hint). Editing the grid happens on /admin/roles/[id].
// =====================================================================

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ApiError, createRole, deleteRole } from "@/lib/api";
import type { RoleSummary } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  fieldClass,
  FieldLabel,
  tableClass,
  tableWrapClass,
  tdClass,
  thClass,
} from "@/components/ui";

export default function RolesManager({
  roles,
  perms,
}: {
  roles: RoleSummary[];
  perms: { create: boolean; update: boolean; delete: boolean };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const role = await createRole({ name, description: description || undefined, permissions: [] });
      router.push(`/admin/roles/${role.id}`); // straight to the grid editor
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Create failed");
      setCreating(false);
    }
  }

  async function onDelete(role: RoleSummary) {
    if (!confirm(`Delete role "${role.name}"?`)) return;
    setError(null);
    setBusyId(role.id);
    try {
      await deleteRole(role.id);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {perms.create && (
        <div>
          <Button icon="plus" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "Cancel" : "New role"}
          </Button>
        </div>
      )}

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {showCreate && perms.create && (
        <Card className="p-5">
          <form onSubmit={onCreate} className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <FieldLabel>Role name</FieldLabel>
              <input required value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
            </label>
            <label className="block">
              <FieldLabel>Description (optional)</FieldLabel>
              <input value={description} onChange={(e) => setDescription(e.target.value)} className={fieldClass} />
            </label>
            <div className="md:col-span-2">
              <Button type="submit" icon="check" disabled={creating}>
                {creating ? "Creating…" : "Create & edit permissions"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className={tableWrapClass}>
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Role</th>
              <th className={thClass}>Users</th>
              <th className={thClass}>Type</th>
              <th className={thClass}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => {
              const busy = busyId === r.id || pending;
              const canDelete = perms.delete && !r.isSystem && r.userCount === 0;
              const deleteTitle = r.isSystem
                ? "System roles cannot be deleted"
                : r.userCount > 0
                  ? "Reassign its users before deleting"
                  : undefined;
              return (
                <tr key={r.id}>
                  <td className={tdClass}>
                    <div className="font-semibold text-slate-950">{r.name}</div>
                    {r.description && <div className="text-xs text-slate-500">{r.description}</div>}
                  </td>
                  <td className={tdClass}>{r.userCount}</td>
                  <td className={tdClass}>
                    {r.scope === "PLATFORM" ? (
                      <Badge tone="purple">Platform</Badge>
                    ) : r.isSystem ? (
                      <Badge tone="blue">System</Badge>
                    ) : (
                      <Badge tone="slate">Custom</Badge>
                    )}
                  </td>
                  <td className={tdClass}>
                    <div className="flex flex-wrap gap-2">
                      {perms.update && r.scope !== "PLATFORM" && (
                        <Link href={`/admin/roles/${r.id}`} className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50">
                          Edit permissions
                        </Link>
                      )}
                      {perms.delete && (
                        <Button variant="danger" disabled={!canDelete || busy} title={deleteTitle} onClick={() => onDelete(r)}>
                          Delete
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
