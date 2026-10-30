"use client";

import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { Switch } from "@/components/ui/switch";
import { setSavedSearchAlerts } from "@/lib/api/me";
import { describeApiError } from "@/lib/api/error-codes";

/**
 * Saved-search alerts: the account-wide switch (one Settings row, approved
 * 2026-10-30 — there is no notifications screen yet). Off silences every
 * followed search at once; the searches keep their own on/off for later.
 */
export function SavedSearchAlertsRow() {
  const t = useTranslations("profile.savedSearchAlerts");
  const tRoot = useTranslations();
  const { user, setUser } = useAuth();
  const mut = useMutation({
    mutationFn: setSavedSearchAlerts,
    onSuccess: (updated) => setUser(updated),
    onError: (error) => toast.error(describeApiError(error, tRoot)),
  });
  if (!user) return null;
  const on = user.savedSearchAlerts !== false;

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border bg-card p-4 text-sm">
      <div className="min-w-0">
        <p className="font-medium">{t("title")}</p>
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
      </div>
      <Switch
        checked={mut.isPending ? !on : on}
        aria-label={t("title")}
        data-testid="saved-search-alerts-switch"
        disabled={mut.isPending}
        onCheckedChange={(value) => mut.mutate(value)}
      />
    </div>
  );
}
