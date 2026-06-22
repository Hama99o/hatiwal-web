"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
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

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      const data = await res.json();
      setUser(data.user ?? null);
      setStatus(data.user ? "authed" : "guest");
    } catch {
      setUser(null);
      setStatus("guest");
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
    setUser(data.user);
    setStatus("authed");
    return { ok: true };
  }, []);

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
    setUser(data.user);
    setStatus("authed");
    return { ok: true };
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setUser(null);
    setStatus("guest");
  }, []);

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
    setUser(data.user);
    setStatus("authed");
    return { ok: true };
  }, []);

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
