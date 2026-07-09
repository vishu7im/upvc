"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ApiError,
  activateUser,
  deactivateUser,
  deleteUser,
  resetUserPassword,
  updateUser,
} from "@/lib/api";
import type { RoleSummary, UserDetail } from "@/lib/types";
import {
  Alert,
  Badge,
  Button,
  Card,
  fieldClass,
  FieldLabel,
  SectionHeader,
  selectClass,
} from "@/components/ui";
import { ToastViewport, type ToastState } from "@/components/toast";

function randomPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const buf = new Uint32Array(12);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => chars[n % chars.length]).join("");
}

function dateTime(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" });
}

export default function UserDetailManager({
  initialUser,
  roles,
  currentUserId,
  perms,
}: {
  initialUser: UserDetail;
  roles: RoleSummary[];
  currentUserId: string;
  perms: { update: boolean; delete: boolean };
}) {
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [profile, setProfile] = useState({
    name: initialUser.name,
    email: initialUser.email,
    phone: initialUser.phone ?? "",
    jobTitle: initialUser.jobTitle ?? "",
    department: initialUser.department ?? "",
  });
  const [roleId, setRoleId] = useState(initialUser.role?.id ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [approvalRequested, setApprovalRequested] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const isSelf = user.id === currentUserId;
  const isSuperAdmin = user.role?.scope === "PLATFORM";

  function notify(message: string, kind: "valid" | "invalid" = "valid") {
    setToast({ id: Date.now(), kind, message });
  }

  async function run<T>(key: string, action: () => Promise<T>): Promise<T | null> {
    setBusy(key);
    setError(null);
    try {
      return await action();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Action failed";
      setError(message);
      notify(message, "invalid");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    const updated = await run("profile", () => updateUser(user.id, {
      name: profile.name.trim(),
      email: profile.email.trim(),
      phone: profile.phone.trim() || null,
      jobTitle: profile.jobTitle.trim() || null,
      department: profile.department.trim() || null,
    }));
    if (updated) {
      setUser(updated);
      notify("Profile saved");
      router.refresh();
    }
  }

  async function saveRole() {
    if (!roleId || roleId === user.role?.id) return;
    const updated = await run("role", () => updateUser(user.id, { roleId }));
    if (updated) {
      setUser(updated);
      notify("Role updated");
      router.refresh();
    }
  }

  async function setActive(active: boolean) {
    const updated = await run("active", () => active ? activateUser(user.id) : deactivateUser(user.id));
    if (updated) {
      setUser(updated);
      notify(active ? "Account activated" : "Account deactivated");
      router.refresh();
    }
  }

  async function resetPassword() {
    const password = randomPassword();
    const result = await run("password", () => resetUserPassword(user.id, password));
    if (result) {
      setTempPassword(password);
      setUser((current) => ({ ...current, mustChangePassword: true }));
      notify("Temporary password created");
    }
  }

  async function removeUser() {
    const result = await run("delete", () => deleteUser(user.id));
    if (!result) return;
    if ("status" in result && result.status === "pending_approval") {
      setApprovalRequested(true);
      setConfirmDelete(false);
      notify("Deletion approval requested");
      return;
    }
    router.push("/admin/users");
    router.refresh();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
      <ToastViewport toast={toast} onExpire={(id) => setToast((current) => current?.id === id ? null : current)} />

      <div className="space-y-5">
        {error && <Alert tone="red" title="Could not update user">{error}</Alert>}
        {approvalRequested && (
          <Alert tone="blue" title={`Approval requested - ${user.name} must approve from their account.`} />
        )}

        <Card>
          <SectionHeader title="Profile" description="Identity and workplace details used across the account." />
          <form onSubmit={saveProfile} className="grid gap-4 p-5 sm:grid-cols-2">
            <label>
              <FieldLabel>Name</FieldLabel>
              <input required disabled={!perms.update} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className={fieldClass} />
            </label>
            <label>
              <FieldLabel>Email</FieldLabel>
              <input type="email" required disabled={!perms.update} value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} className={fieldClass} />
            </label>
            <label>
              <FieldLabel>Phone</FieldLabel>
              <input disabled={!perms.update} value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} className={fieldClass} />
            </label>
            <label>
              <FieldLabel>Job title</FieldLabel>
              <input disabled={!perms.update} value={profile.jobTitle} onChange={(e) => setProfile({ ...profile, jobTitle: e.target.value })} className={fieldClass} />
            </label>
            <label className="sm:col-span-2">
              <FieldLabel>Department</FieldLabel>
              <input disabled={!perms.update} value={profile.department} onChange={(e) => setProfile({ ...profile, department: e.target.value })} className={fieldClass} />
            </label>
            {perms.update && (
              <div className="sm:col-span-2">
                <Button type="submit" icon="check" disabled={busy === "profile"}>{busy === "profile" ? "Saving..." : "Save profile"}</Button>
              </div>
            )}
          </form>
        </Card>

        <Card>
          <SectionHeader title="Role" description="Role changes take effect on the user's next request." />
          <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
            <label className="w-full max-w-md">
              <FieldLabel>Assigned role</FieldLabel>
              <select
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                disabled={!perms.update || isSelf}
                title={isSelf ? "You cannot change your own role" : undefined}
                className={selectClass}
              >
                {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
              </select>
            </label>
            {perms.update && (
              <Button variant="secondary" onClick={saveRole} disabled={isSelf || roleId === user.role?.id || busy === "role"}>
                {busy === "role" ? "Updating..." : "Update role"}
              </Button>
            )}
          </div>
        </Card>
      </div>

      <div className="space-y-5">
        <Card>
          <SectionHeader title="Account" description="Access state, password rotation, and account history." />
          <dl className="divide-y divide-slate-100 px-5">
            <div className="flex items-center justify-between gap-4 py-4">
              <dt className="text-sm text-slate-500">Status</dt>
              <dd><Badge tone={user.isActive ? "green" : "red"}>{user.isActive ? "Active" : "Inactive"}</Badge></dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-4">
              <dt className="text-sm text-slate-500">Last login</dt>
              <dd className="text-right text-sm font-medium text-slate-800">{dateTime(user.lastLoginAt)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-4">
              <dt className="text-sm text-slate-500">Created</dt>
              <dd className="text-right text-sm font-medium text-slate-800">{dateTime(user.createdAt)}</dd>
            </div>
          </dl>
          {perms.update && (
            <div className="flex flex-wrap gap-2 border-t border-slate-200 p-5">
              <Button
                variant="secondary"
                onClick={() => setActive(!user.isActive)}
                disabled={busy === "active" || (isSelf && user.isActive)}
                title={isSelf && user.isActive ? "You cannot deactivate yourself" : undefined}
              >
                {user.isActive ? "Deactivate" : "Activate"}
              </Button>
              <Button
                variant="secondary"
                onClick={resetPassword}
                disabled={busy === "password" || isSelf}
                title={isSelf ? "Use change password for your own account" : undefined}
              >
                {busy === "password" ? "Resetting..." : "Reset password"}
              </Button>
            </div>
          )}
        </Card>

        {tempPassword && (
          <Card className="border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-semibold text-amber-950">Temporary password, shown once</p>
            <code className="mt-3 block overflow-x-auto rounded-md border border-amber-200 bg-white px-3 py-2 font-bold text-slate-950">{tempPassword}</code>
            <Button className="mt-3" variant="ghost" icon="x" onClick={() => setTempPassword(null)}>Dismiss</Button>
          </Card>
        )}

        {perms.delete && (
          <Card className="border-red-200">
            <SectionHeader title="Danger zone" description={isSuperAdmin ? "A peer approval is required before this Super Admin can be deleted." : "Deleting an account is permanent."} />
            <div className="p-5">
              {confirmDelete ? (
                <div className="space-y-3">
                  <Alert tone="red" title={isSuperAdmin ? "Request peer-approved deletion?" : "Delete this user?"}>
                    {isSuperAdmin ? `${user.name} must approve this request from their own account.` : "This action cannot be undone."}
                  </Alert>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="danger" onClick={removeUser} disabled={busy === "delete" || isSelf}>
                      {busy === "delete" ? "Working..." : isSuperAdmin ? "Send request" : "Delete user"}
                    </Button>
                    <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="danger"
                  onClick={() => setConfirmDelete(true)}
                  disabled={isSelf || approvalRequested}
                  title={isSelf ? "You cannot delete your own account" : undefined}
                >
                  {isSuperAdmin ? "Request deletion" : "Delete user"}
                </Button>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
