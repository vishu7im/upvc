"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ApiError, createRole, deleteRole } from "@/lib/api";
import type { RoleSummary } from "@/lib/types";
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  fieldClass,
  FieldLabel,
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
  const [showCreate, setShowCreate] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const role = await createRole({ name, description: description || undefined, permissions: [] });
      router.push(`/admin/roles/${role.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create role");
      setCreating(false);
    }
  }

  async function onDelete(role: RoleSummary) {
    setError(null);
    setBusyId(role.id);
    try {
      await deleteRole(role.id);
      setConfirmId(null);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete role");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {perms.create && (
        <div className="flex justify-end">
          <Button icon={showCreate ? "x" : "plus"} onClick={() => setShowCreate((open) => !open)}>
            {showCreate ? "Close" : "New role"}
          </Button>
        </div>
      )}

      {error && <Alert tone="red" title="Could not complete the request">{error}</Alert>}

      {showCreate && perms.create && (
        <Card>
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold text-slate-950">Create a custom role</h2>
            <p className="mt-1 text-sm text-slate-500">Start with an empty permission grid, then assign access.</p>
          </div>
          <form onSubmit={onCreate} className="grid gap-4 p-5 md:grid-cols-2">
            <label>
              <FieldLabel>Role name</FieldLabel>
              <input required value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
            </label>
            <label>
              <FieldLabel>Description</FieldLabel>
              <input value={description} onChange={(e) => setDescription(e.target.value)} className={fieldClass} />
            </label>
            <div className="md:col-span-2">
              <Button type="submit" icon="check" disabled={creating}>
                {creating ? "Creating..." : "Create and edit permissions"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {roles.length === 0 ? (
        <EmptyState icon="admin" title="No roles found" description="Create a role to define a new access profile." />
      ) : (
        <div className="grid gap-3">
          {roles.map((role) => {
            const canDelete = perms.delete && !role.isSystem && role.userCount === 0;
            const deleteTitle = role.isSystem
              ? "System roles cannot be deleted"
              : role.userCount > 0
                ? "Reassign its users before deleting"
                : undefined;
            return (
              <Card key={role.id} className="overflow-hidden">
                <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-slate-950">{role.name}</h2>
                      <Badge tone={role.scope === "PLATFORM" ? "purple" : role.isSystem ? "blue" : "slate"}>
                        {role.scope === "PLATFORM" ? "Platform" : role.isSystem ? "System" : "Custom"}
                      </Badge>
                    </div>
                    <p className="mt-1 max-w-3xl text-sm text-slate-500">{role.description ?? "No description"}</p>
                    <p className="mt-2 text-xs font-semibold uppercase text-slate-500">{role.userCount} {role.userCount === 1 ? "user" : "users"}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {perms.update && role.scope !== "PLATFORM" && (
                      <ButtonLink href={`/admin/roles/${role.id}`} variant="secondary" icon="settings">Edit role</ButtonLink>
                    )}
                    {perms.delete && (
                      <Button
                        variant="danger"
                        disabled={!canDelete || pending || busyId === role.id}
                        title={deleteTitle}
                        onClick={() => setConfirmId(role.id)}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
                {confirmId === role.id && (
                  <div className="flex flex-col gap-3 border-t border-red-200 bg-red-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-medium text-red-900">Delete {role.name}? This cannot be undone.</p>
                    <div className="flex gap-2">
                      <Button variant="danger" onClick={() => onDelete(role)} disabled={busyId === role.id}>
                        {busyId === role.id ? "Deleting..." : "Confirm delete"}
                      </Button>
                      <Button variant="secondary" onClick={() => setConfirmId(null)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
