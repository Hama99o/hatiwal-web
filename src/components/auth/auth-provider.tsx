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
  /**
   * The session probe has gone unanswered for longer than `PROBE_BUDGET_MS` and
   * `status` is still "loading". PRESENTATIONAL ONLY — the probe itself is still
   * running (it is never aborted, see `refresh`) and still wins when it lands.
   * It exists so a control whose viewer is GENUINELY unknown (no SSR hint — an
   * ISR page) can stop claiming "pending" forever and fall back to its guest
   * markup, which a tap can recover from. A control the server already answered
   * for must ignore it: rendering "sign in" UI for a viewer the server said is
   * signed in is the one thing it must never do.
   */
  probeTimedOut: boolean;
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

/**
 * How long an unanswered session probe may keep dependent controls waiting
 * before they stop claiming "pending" (see `probeTimedOut`). It bounds the UI,
 * never the request.
 */
const PROBE_BUDGET_MS = 8_000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [probeTimedOut, setProbeTimedOut] = useState(false);

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
        // NEVER give this request an abort signal. Two independent reasons:
        //
        //  1. It ROTATES the session. `/api/auth/session` calls Rails and then
        //     re-persists the rotated devise access-token, which only reaches
        //     the browser in THIS response's Set-Cookie. Abort it after Rails
        //     has already rotated and the browser keeps a token Rails has
        //     replaced; the next request presents the stale one, and once that
        //     is outside devise_token_auth's `batch_request_buffer_throttle`
        //     (default 5s — see lib/auth/cookies.ts) Rails answers 401 and the
        //     route clears the cookies. We would manufacture the one 401 this
        //     whole file is careful never to cause: a valid session silently
        //     signed out on exactly the slow network the timeout was for.
        //  2. `AbortSignal.timeout` is not universal — absent on Safari <16
        //     (every iPhone still on iOS 15), Chrome/WebView <103, Firefox <100
        //     — and Next does not polyfill it. The expression THROWS
        //     synchronously there, before `fetch` is called, so all four
        //     attempts would fail without a single network request and every
        //     signed-in visitor on those browsers would be shown as a guest.
        //
        // A hang is bounded in the UI instead, by `probeTimedOut` below.
        const res = await fetch("/api/auth/session", { cache: "no-store" });
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

  // The backoff in `refresh` only covers REJECTIONS. A probe that simply HANGS
  // (dead mobile network, captive portal — normal in this market) never rejects,
  // so the retry loop never gets a turn and `status` stays "loading" for as long
  // as the socket does. This bounds what that costs the UI without touching the
  // request: after the budget, a control that has no server hint about its viewer
  // may stop announcing itself pending and render its guest markup instead (see
  // save-button.tsx). Nothing is demoted — `user`/`status` are untouched, the
  // probe is still in flight, and whatever it finally answers wins.
  useEffect(() => {
    if (status !== "loading") {
      setProbeTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setProbeTimedOut(true), PROBE_BUDGET_MS);
    return () => clearTimeout(timer);
  }, [status]);

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
        probeTimedOut,
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
