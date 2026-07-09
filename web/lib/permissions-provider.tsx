"use client";

// =====================================================================
// PermissionsProvider — makes the current user available to Client Components
// that don't receive it as a prop (row-action buttons, etc.), so they can gate
// on can(). Mounted once in (app)/layout.tsx, which already resolves the user
// server-side.
// =====================================================================

import { createContext, useContext } from "react";
import type { AuthUser } from "./types";

const UserContext = createContext<AuthUser | null>(null);

export function PermissionsProvider({
  user,
  children,
}: {
  user: AuthUser;
  children: React.ReactNode;
}) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

/** The current user in a Client Component (null if used outside the provider). */
export function useCurrentUser(): AuthUser | null {
  return useContext(UserContext);
}
