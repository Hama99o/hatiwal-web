"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "@/lib/types";

type AuthStatus = "loading" | "authed" | "guest";

interface RegisterInput {
  email: string;
  password: string;
  passwordConfirmation: string;
  firstname: string;
  lastname: string;
}

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  login: (
    email: string,
    password: string,
  ) => Promise<{
    ok: boolean;
    error?: string;
    status?: string;
    reason?: string | null;
  }>;
  register: (
    input: RegisterInput,
  ) => Promise<{ ok: boolean; errors?: Record<string, string[]> }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (user: User) => void;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (
    token: string,
    password: string,
    passwordConfirmation: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  googleLogin: (idToken: string) => Promise<{
    ok: boolean;
    error?: string;
    status?: string;
    reason?: string | null;
  }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  // AuthProvider is nested INSIDE QueryClientProvider (see components/providers.tsx),
  // so the cache is reachable from here. That matters because of the leak below.
  const queryClient = useQueryClient();

  /**
   * Drop every cached query at an identity boundary.
   *
   * Logging out used to clear only React state, and nothing anywhere in the app
   * evicted the TanStack cache (its one eviction was a scoped removeQueries for a
   * deleted listing). So on a shared browser: user A signs out, user B signs in,
   * and ['saved-listings'], ['my-listings'] and ['conversations'] still held A's
   * rows until something happened to refetch them — B was shown A's saved items,
   * A's shop and A's conversation list. That is a cross-user data leak, not mere
   * staleness, and it bites hardest here: shared phones and shared computers are
   * normal for this marketplace, and conversations carry meetup details.
   *
   * Clearing once, centrally, at the transition beats viewer-scoping every query
   * key: a new unscoped key added later would silently reintroduce the leak,
   * whereas this cannot be forgotten. The cost is one refetch of public data
   * (categories, listings) at sign-in/sign-out, which is negligible.
   */
  const clearCacheForIdentityChange = useCallback(() => {
    queryClient.clear();
  }, [queryClient]);

  const refresh = useCallback(async () => {
    // The session probe clears cookies ONLY on an explicit 401; a transient
    // failure (Rails 5xx/unreachable) returns 503 or {transient:true} with the
    // cookies intact. Never demote a possibly-valid session to guest on such a
    // blip — retry with backoff, and only fall back to guest (for a
    // never-authed load) once retries are exhausted. A real guest is a 200 with
    // user:null and resolves on the first attempt.
    for (let attempt = 0; attempt <= 3; attempt++) {
      try {
        const res = await fetch("/api/auth/session", {
          cache: "no-store",
          // Bounded, because the backoff below only covers REJECTIONS: a request
          // that simply hangs (dead mobile network, captive portal — normal in
          // this market) left `status` at "loading" forever, and every control
          // that waits on it stuck in its unsettled state. A timeout turns that
          // into a rejection the retry loop can handle, and worst case it now
          // resolves to guest, which a reload recovers from.
          signal: AbortSignal.timeout(8_000),
        });
        if (res.status === 503) throw new Error("transient");
        const data = await res.json();
        if (data?.transient) throw new Error("transient");
        setUser(data.user ?? null);
        setStatus(data.user ? "authed" : "guest");
        return;
      } catch {
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          continue;
        }
        // Retries exhausted. Cookies were NOT cleared, so keep an already-authed
        // session; a never-resolved load falls back to guest (recoverable on reload).
        setStatus((s) => (s === "authed" ? s : "guest"));
      }
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: err?.error,
        status: err?.status,
        reason: err?.reason,
      };
    }
    const data = await res.json();
    // Before adopting the new identity — a previous user's rows must never be
    // visible to this one, even for the instant before a refetch lands.
    clearCacheForIdentityChange();
    setUser(data.user);
    setStatus("authed");
    return { ok: true };
  }, [clearCacheForIdentityChange]);

  const register = useCallback(async (input: RegisterInput) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, errors: data?.errors ?? undefined };
    }
    const data = await res.json();
    clearCacheForIdentityChange();
    setUser(data.user);
    setStatus("authed");
    return { ok: true };
  }, [clearCacheForIdentityChange]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setUser(null);
    setStatus("guest");
    // AFTER flipping to guest, so anything that refetches in response to the
    // state change does so as a guest rather than re-populating with the
    // signed-out user's data. Runs even if the logout request itself failed —
    // the local session is being abandoned either way.
    clearCacheForIdentityChange();
  }, [clearCacheForIdentityChange]);

  const forgotPassword = useCallback(async (email: string) => {
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  }, []);

  const resetPassword = useCallback(
    async (
      token: string,
      password: string,
      passwordConfirmation: string,
    ) => {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, passwordConfirmation }),
      });
      if (!res.ok) return { ok: false, error: "invalid_token" };
      return { ok: true };
    },
    [],
  );

  const googleLogin = useCallback(async (idToken: string) => {
    const res = await fetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: err?.error,
        status: err?.status,
        reason: err?.reason,
      };
    }
    const data = await res.json();
    clearCacheForIdentityChange();
    setUser(data.user);
    setStatus("authed");
    return { ok: true };
  }, [clearCacheForIdentityChange]);

  return (
    <AuthContext.Provider
      value={{
        user,
        status,
        login,
        register,
        logout,
        refresh,
        setUser,
        forgotPassword,
        resetPassword,
        googleLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
