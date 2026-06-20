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
  ) => Promise<{ ok: boolean }>;
  register: (
    input: RegisterInput,
  ) => Promise<{ ok: boolean; errors?: Record<string, string[]> }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (user: User) => void;
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
    if (!res.ok) return { ok: false };
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

  return (
    <AuthContext.Provider
      value={{ user, status, login, register, logout, refresh, setUser }}
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
