"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { restoreAccount } from "@/lib/api/me";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/**
 * Restore banner — shown when the signed-in account is scheduled for deletion
 * (the user logged back in within the 30-day grace window). Mobile parity.
 */
export function RestoreAccountBanner() {
  const t = useTranslations();
  const { user, setUser } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!user?.deletionScheduledAt) return null;

  async function restore() {
    setBusy(true);
    try {
      const updated = await restoreAccount();
      setUser(updated);
      toast.success(t("deleteAccount.restoredToast"));
    } catch {
      toast.error(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
      <p className="text-sm font-semibold text-destructive">
        {t("deleteAccount.restoreTitle")}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("deleteAccount.restoreBody")}
      </p>
      <Button size="sm" className="mt-3" disabled={busy} onClick={restore}>
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <RotateCcw className="size-4" />
        )}
        {t("deleteAccount.restoreButton")}
      </Button>
    </div>
  );
}

/** Danger-zone account deletion (mobile parity for `DELETE /auth`). */
export function DeleteAccountButton() {
  const t = useTranslations();
  const { refresh } = useAuth();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function doDelete() {
    setConfirm(false);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/delete", { method: "POST" });
      if (!res.ok) throw new Error("delete failed");
      await refresh(); // cookies cleared → back to guest
      toast.success(t("deleteAccount.deletedToast"));
      router.push("/");
    } catch {
      toast.error(t("common.error"));
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        className="w-full text-destructive hover:text-destructive"
        disabled={busy}
        onClick={() => setConfirm(true)}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Trash2 className="size-4" />
        )}
        {t("deleteAccount.deleteButton")}
      </Button>
      <ConfirmDialog
        open={confirm}
        title={t("deleteAccount.confirmTitle")}
        description={t("deleteAccount.confirmBody")}
        confirmLabel={t("deleteAccount.deleteButton")}
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={doDelete}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}
