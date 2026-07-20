"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import {
  createReport,
  type ReportableType,
  type ReportReason,
} from "@/lib/api/reports";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const REASONS: ReportReason[] = [
  "spam",
  "inappropriate",
  "fraud",
  "wrong_category",
  "prohibited_item",
  "other",
];

/**
 * Report a listing or a user. Mirrors the mobile ReportSheet. Guests are sent
 * to sign in; hidden on your own listing/profile. Reuses the existing `report`
 * translation namespace (all 3 locales).
 */
export function ReportButton({
  reportableType,
  reportableId,
  ownerId,
  className,
}: {
  reportableType: ReportableType;
  reportableId: number;
  /** Owner of the reported thing — used to hide the button on your own content. */
  ownerId?: number;
  className?: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const { status, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const titleId = useId();
  const noteId = useId();

  // Don't let people report their own listing / their own profile.
  const ownId = reportableType === "User" ? reportableId : ownerId;
  if (status === "authed" && user && ownId && user.id === ownId) return null;

  function onTrigger() {
    if (status !== "authed") {
      router.push("/login");
      return;
    }
    setOpen(true);
  }

  async function submit() {
    if (!reason) {
      toast.error(t("report.reasonRequired"));
      return;
    }
    setBusy(true);
    try {
      await createReport({
        reportableType,
        reportableId,
        reason,
        note: note.trim() || undefined,
      });
      toast.success(t("report.success"));
      setOpen(false);
      setReason(null);
      setNote("");
    } catch {
      toast.error(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={onTrigger}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          className,
        )}
      >
        <Flag className="size-4 shrink-0" />
        <span>{t("report.title")}</span>
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        labelledBy={titleId}
        dismissible={!busy}
        className="max-w-sm space-y-4"
      >
        <div>
          <h2 id={titleId} className="text-lg font-semibold">
            {t("report.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("report.subtitle")}
          </p>
        </div>

        <div className="space-y-1.5">
              <p className="text-sm font-medium">{t("report.reasonLabel")}</p>
              <div className="space-y-1">
                {REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-start text-sm transition-colors",
                      reason === r
                        ? "border-primary bg-primary/5 font-medium"
                        : "border-input hover:bg-accent",
                    )}
                  >
                    <span
                      className={cn(
                        "size-3.5 shrink-0 rounded-full border-2",
                        reason === r
                          ? "border-primary bg-primary"
                          : "border-muted-foreground/40",
                      )}
                    />
                    {t(`report.reasons.${r}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor={noteId} className="text-sm font-medium">
                {t("report.noteLabel")}
              </label>
              <textarea
                id={noteId}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder={t("report.notePlaceholder")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                {t("common.cancel")}
              </Button>
              <Button onClick={submit} disabled={busy || !reason}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                {busy ? t("report.submitting") : t("report.submit")}
              </Button>
            </div>
      </Dialog>
    </>
  );
}
