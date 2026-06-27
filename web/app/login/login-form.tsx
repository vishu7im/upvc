"use client";

// =====================================================================
// Login form (Client Component). Calls the BFF login() helper, which stores
// the JWT in an httpOnly cookie server-side and returns only { user }. On
// success we navigate to the dashboard and refresh so the protected layout
// re-evaluates with the new cookie.
// =====================================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, ApiError } from "@/lib/api";
import { Button, fieldClass, FieldLabel } from "@/components/ui";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.replace("/");
      router.refresh();
      // Leave loading=true: the component unmounts on navigation.
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-5">
      <label className="block">
        <FieldLabel>Email</FieldLabel>
        <input
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={fieldClass}
        />
      </label>

      <label className="block">
        <FieldLabel>Password</FieldLabel>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={fieldClass}
        />
      </label>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="w-full"
      >
        {loading ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
