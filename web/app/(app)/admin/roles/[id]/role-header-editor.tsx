"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, updateRole } from "@/lib/api";
import type { RoleDetail } from "@/lib/types";
import { Button, fieldClass } from "@/components/ui";

export default function RoleHeaderEditor({ role }: { role: RoleDetail }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateRole(role.id, { name: name.trim(), description: description.trim() || null });
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update role");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return <Button variant="secondary" icon="settings" onClick={() => setEditing(true)}>Edit details</Button>;
  }

  return (
    <form onSubmit={save} className="grid w-full gap-2 sm:w-[520px] sm:grid-cols-[180px_minmax(220px,1fr)_auto]">
      <input aria-label="Role name" required value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
      <input aria-label="Role description" value={description} onChange={(e) => setDescription(e.target.value)} className={fieldClass} />
      <div className="flex gap-1">
        <Button type="submit" icon="check" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        <Button type="button" variant="ghost" icon="x" aria-label="Cancel editing" onClick={() => setEditing(false)} />
      </div>
      {error && <p className="text-sm text-red-700 sm:col-span-3">{error}</p>}
    </form>
  );
}
