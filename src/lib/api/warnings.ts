import { meRequest } from "./me";

// Mirrors the mobile warnings contract (src/api/warnings.ts).
export interface UserWarning {
  id: number;
  category: string;
  reason: string;
  createdAt: string;
  expiresAt: string;
  acknowledgedAt: string | null;
  active: boolean;
}

export interface WarningsResult {
  warnings: UserWarning[];
  activeCount: number;
  threshold: number;
}

export async function getWarnings(): Promise<WarningsResult> {
  // Rails returns { warnings, meta: { activeCount, threshold } } — same as mobile.
  const d = await meRequest<{
    warnings: UserWarning[];
    meta?: { activeCount: number; threshold: number };
  }>("users/warnings");
  return {
    warnings: d.warnings ?? [],
    activeCount: d.meta?.activeCount ?? 0,
    threshold: d.meta?.threshold ?? 0,
  };
}

export async function markWarningsSeen(): Promise<void> {
  await meRequest("users/warnings/mark_seen", { method: "PUT" });
}
