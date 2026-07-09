"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ApiError, createUser } from "@/lib/api";
import { dateShort } from "@/lib/format";
import type { RoleSummary, UserRow } from "@/lib/types";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  fieldClass,
  FieldLabel,
  selectClass,
  tableClass,
  tableWrapClass,
  tdClass,
  thClass,
} from "@/components/ui";
import { Icon } from "@/components/icons";

function randomPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const buf = new Uint32Array(12);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => chars[n % chars.length]).join("");
}

function dateTime(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function UsersManager({
  users,
  roles,
  search,
  canCreate,
}: {
  users: UserRow[];
  roles: RoleSummary[];
  search: string;
  canCreate: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [query, setQuery] = useState(search);

  function refresh() {
    startTransition(() => router.refresh());
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const sp = new URLSearchParams();
    if (query.trim()) sp.set("search", query.trim());
    router.push(`/admin/users${sp.size ? `?${sp}` : ""}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={onSearch} className="flex w-full max-w-xl items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email"
              className={`${fieldClass} pl-10`}
            />
          </div>
          <Button type="submit" variant="secondary" disabled={pending}>Search</Button>
        </form>
        {canCreate && (
          <Button icon={showCreate ? "x" : "plus"} onClick={() => setShowCreate((open) => !open)}>
            {showCreate ? "Close" : "Invite user"}
          </Button>
        )}
      </div>

      {error && <Alert tone="red" title="Could not complete the request">{error}</Alert>}

      {showCreate && canCreate && (
        <CreateUserForm
          roles={roles}
          onDone={() => {
            setShowCreate(false);
            refresh();
          }}
          onError={setError}
        />
      )}

      {users.length === 0 ? (
        <EmptyState
          icon="user"
          title={search ? "No matching users" : "No users yet"}
          description={search ? "Try a different name or email address." : "Invite the first user to create an account."}
        />
      ) : (
        <div className={tableWrapClass}>
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>User</th>
                  <th className={thClass}>Role</th>
                  <th className={thClass}>Status</th>
                  <th className={`${thClass} hidden md:table-cell`}>Last login</th>
                  <th className={`${thClass} hidden md:table-cell`}>Created</th>
                  <th className={`${thClass} w-12`}><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="group cursor-pointer transition hover:bg-slate-50"
                    onClick={() => router.push(`/admin/users/${user.id}`)}
                  >
                    <td className={tdClass}>
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="block font-semibold text-slate-950 group-hover:text-[#4442e3]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {user.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-500">{user.email}</p>
                    </td>
                    <td className={tdClass}>
                      <Badge tone={user.role?.scope === "PLATFORM" ? "purple" : "blue"}>
                        {user.role?.name ?? "No role"}
                      </Badge>
                    </td>
                    <td className={tdClass}>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge tone={user.isActive ? "green" : "red"}>{user.isActive ? "Active" : "Inactive"}</Badge>
                        {user.mustChangePassword && <Badge tone="amber">Password change due</Badge>}
                      </div>
                    </td>
                    <td className={`${tdClass} hidden whitespace-nowrap text-slate-600 md:table-cell`}>{dateTime(user.lastLoginAt)}</td>
                    <td className={`${tdClass} hidden whitespace-nowrap text-slate-600 md:table-cell`}>{dateShort(user.createdAt)}</td>
                    <td className={`${tdClass} text-right text-slate-400 group-hover:text-[#4442e3]`}>
                      <Icon name="chevronRight" className="h-4 w-4" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
  onError: (message: string) => void;
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
      onError(err instanceof ApiError ? err.message : "Could not create user");
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="font-semibold text-slate-950">Invite a user</h2>
        <p className="mt-1 text-sm text-slate-500">The temporary password is shown here and must be changed at first login.</p>
      </div>
      <form onSubmit={submit} className="grid gap-4 p-5 md:grid-cols-2">
        <label>
          <FieldLabel>Name</FieldLabel>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
        </label>
        <label>
          <FieldLabel>Email</FieldLabel>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} />
        </label>
        <label>
          <FieldLabel>Temporary password</FieldLabel>
          <input required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={fieldClass} />
        </label>
        <label>
          <FieldLabel>Role</FieldLabel>
          <select required value={roleId} onChange={(e) => setRoleId(e.target.value)} className={selectClass}>
            {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
          </select>
        </label>
        <div className="md:col-span-2">
          <Button type="submit" icon="check" disabled={saving || !roleId}>
            {saving ? "Creating..." : "Create user"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
