"use client";

// =====================================================================
// Users manager (Client Component). Renders the users table with row actions
// gated by the server-derived `perms` flags: assign role (inline select),
// activate/deactivate, reset password (generates a temp password shown once),
// delete. Every action calls the BFF and router.refresh()es on success. The
// server re-enforces all invariants — these gates are UX, not security.
// =====================================================================

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ApiError,
  activateUser,
  createUser,
  deactivateUser,
  deleteUser,
  resetUserPassword,
  updateUser,
} from "@/lib/api";
import type { RoleSummary, UserRow } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  fieldClass,
  FieldLabel,
  selectClass,
  tableClass,
  tableWrapClass,
  tdClass,
  thClass,
} from "@/components/ui";

function randomPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  const buf = new Uint32Array(12);
  crypto.getRandomValues(buf);
  for (const n of buf) out += chars[n % chars.length];
  return out;
}

export default function UsersManager({
  users,
  roles,
  currentUserId,
  search,
  perms,
}: {
  users: UserRow[];
  roles: RoleSummary[];
  currentUserId: string;
  search: string;
  perms: { create: boolean; update: boolean; delete: boolean };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [resetInfo, setResetInfo] = useState<{ email: string; password: string } | null>(null);

  const [query, setQuery] = useState(search);

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function run(id: string, fn: () => Promise<unknown>) {
    setError(null);
    setBusyId(id);
    try {
      await fn();
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const sp = new URLSearchParams();
    if (query.trim()) sp.set("search", query.trim());
    router.push(`/admin/users${sp.toString() ? `?${sp}` : ""}`);
  }

  async function onReset(u: UserRow) {
    const password = randomPassword();
    await run(u.id, () => resetUserPassword(u.id, password));
    setResetInfo({ email: u.email, password });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form onSubmit={onSearch} className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email…"
            className={`${fieldClass} w-64`}
          />
          <Button type="submit" variant="secondary" icon="search">Search</Button>
        </form>
        {perms.create && (
          <Button icon="plus" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "Cancel" : "Invite user"}
          </Button>
        )}
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {resetInfo && (
        <Card className="border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            Temporary password for {resetInfo.email} (shown once):
          </p>
          <code className="mt-2 inline-block rounded bg-white px-3 py-1.5 text-sm font-bold text-slate-900 ring-1 ring-amber-300">
            {resetInfo.password}
          </code>
          <div className="mt-3">
            <Button variant="ghost" icon="x" onClick={() => setResetInfo(null)}>Dismiss</Button>
          </div>
        </Card>
      )}

      {showCreate && perms.create && (
        <CreateUserForm roles={roles} onDone={() => { setShowCreate(false); refresh(); }} onError={setError} />
      )}

      <div className={tableWrapClass}>
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>User</th>
              <th className={thClass}>Role</th>
              <th className={thClass}>Status</th>
              <th className={thClass}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr><td className={tdClass} colSpan={4}>No users found.</td></tr>
            )}
            {users.map((u) => {
              const isSelf = u.id === currentUserId;
              const busy = busyId === u.id || pending;
              return (
                <tr key={u.id}>
                  <td className={tdClass}>
                    <div className="font-semibold text-slate-950">{u.name}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </td>
                  <td className={tdClass}>
                    {perms.update && !isSelf ? (
                      <select
                        className={`${selectClass} h-9 w-48`}
                        value={u.role?.id ?? ""}
                        disabled={busy}
                        onChange={(e) => run(u.id, () => updateUser(u.id, { roleId: e.target.value }))}
                      >
                        {!u.role && <option value="">— none —</option>}
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    ) : (
                      <span>{u.role?.name ?? "—"}</span>
                    )}
                  </td>
                  <td className={tdClass}>
                    {u.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Inactive</Badge>}
                    {u.mustChangePassword && <Badge tone="amber" className="ml-1">Must reset</Badge>}
                  </td>
                  <td className={tdClass}>
                    <div className="flex flex-wrap gap-2">
                      {perms.update && (
                        <>
                          {u.isActive ? (
                            <Button
                              variant="secondary"
                              disabled={busy || isSelf}
                              title={isSelf ? "You cannot deactivate yourself" : undefined}
                              onClick={() => run(u.id, () => deactivateUser(u.id))}
                            >
                              Deactivate
                            </Button>
                          ) : (
                            <Button variant="secondary" disabled={busy} onClick={() => run(u.id, () => activateUser(u.id))}>
                              Activate
                            </Button>
                          )}
                          <Button
                            variant="secondary"
                            disabled={busy || isSelf}
                            title={isSelf ? "Use the change-password screen for your own account" : undefined}
                            onClick={() => onReset(u)}
                          >
                            Reset password
                          </Button>
                        </>
                      )}
                      {perms.delete && (
                        <Button
                          variant="danger"
                          disabled={busy || isSelf}
                          title={isSelf ? "You cannot delete yourself" : undefined}
                          onClick={() => {
                            if (confirm(`Delete ${u.email}? This cannot be undone.`)) run(u.id, () => deleteUser(u.id));
                          }}
                        >
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

function CreateUserForm({
  roles,
  onDone,
  onError,
}: {
  roles: RoleSummary[];
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState(randomPassword());
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createUser({ email, name, password, roleId });
      onDone();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Create failed");
      setSaving(false);
    }
  }

  return (
    <Card className="p-5">
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <FieldLabel>Name</FieldLabel>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
        </label>
        <label className="block">
          <FieldLabel>Email</FieldLabel>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} />
        </label>
        <label className="block">
          <FieldLabel>Temporary password (user must change on first login)</FieldLabel>
          <input required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={fieldClass} />
        </label>
        <label className="block">
          <FieldLabel>Role</FieldLabel>
          <select required value={roleId} onChange={(e) => setRoleId(e.target.value)} className={selectClass}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </label>
        <div className="md:col-span-2">
          <Button type="submit" icon="check" disabled={saving}>
            {saving ? "Creating…" : "Create user"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
