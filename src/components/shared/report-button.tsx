"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { useIsOwner, useServerViewerId } from "@/components/auth/owner-gate";
import {
  createReport,
  type ReportableType,
  type ReportReason,
} from "@/lib/api/reports";
import { blockUser } from "@/lib/api/chat";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { unsettledProps, useQueuedTap } from "@/lib/unsettled";
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
 *
 * After a successful **User** report it closes the loop the same way mobile's
 * ReportSheet does (TASK-R612): the reporter is offered a follow-up confirm to
 * also block that person, so "this user is abusive" and "stop them contacting
 * me" are one flow. A **Listing** report never prompts.
 */
export function ReportButton({
  reportableType,
  reportableId,
  ownerId,
  className,
  alreadyBlocked,
  onBlocked,
}: {
  reportableType: ReportableType;
  reportableId: number;
  /** Owner of the reported thing — used to hide the button on your own content. */
  ownerId?: number;
  className?: string;
  /**
   * The reported user is already blocked by the current user — skip the
   * follow-up block prompt entirely (never offer to block someone twice).
   * Only meaningful for `reportableType === "User"`.
   */
  alreadyBlocked?: boolean;
  /**
   * Called after a successful block from the follow-up prompt, so a host that
   * owns its own block state (the conversation thread header) can flip its
   * shield icon without a refetch. Never called on cancel or on failure.
   */
  onBlocked?: () => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const { status } = useAuth();
  // Don't let people report their own listing / their own profile. Reporting a
  // *user* means the reportable IS the owner; for a listing it's its seller.
  // Same shared owner rule as every other owner-gated control (`useIsOwner`).
  const isOwner = useIsOwner(
    reportableType === "User" ? reportableId : ownerId,
  );
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [blockPromptOpen, setBlockPromptOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const titleId = useId();
  const noteId = useId();

  // Third control on the listing page that must not GUESS who the viewer is —
  // same contract, same module, as the message CTA and the save heart
  // (lib/unsettled.ts). `status` is "loading" on every load until
  // /api/auth/session answers, and this trigger used to read that as "not
  // authed" and push /login: a signed-in person who tapped Report during
  // bootstrap was thrown off the page they wanted to report, and the report they
  // came to file was lost. The page's SSR hint answers for free where it exists
  // (`null` = the request carried no session, which the browser cannot
  // contradict), so only a genuinely unknown viewer waits — and their tap is
  // held and replayed against the resolved identity.
  const serverGuest = useServerViewerId() === null;
  const unsettled = status === "loading" && !serverGuest;
  const { queued, queue } = useQueuedTap(unsettled, () => {
    if (status !== "authed") {
      router.push("/login");
      return;
    }
    setOpen(true);
  });

  if (isOwner) return null;

  function onTrigger() {
    if (unsettled) {
      queue();
      return;
    }
    if (status !== "authed") {
      router.push("/login");
      return;
    }
    setOpen(true);
  }

  // `tone: "text"` — a labelled control, so no visible pre-tap cue (the trigger is
  // already `text-muted-foreground`, and dimming it further would fail AA);
  // `aria-busy` carries the state, and the spinner replacing the flag is the
  // "I heard you" the moment a tap is held. Same treatment as the primary CTA on
  // the listing page, because lib/unsettled.ts decides it for both.
  const state = unsettledProps({
    unknown: unsettled,
    busy: queued,
    queued,
    tone: "text",
  });

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
        description: note.trim() || undefined,
      });
      toast.success(t("report.success"));
      setOpen(false);
      setReason(null);
      setNote("");
      // Reporting a person → offer to also block them. Reporting a listing
      // keeps the original behaviour (success toast, no prompt), and someone
      // already blocked is never offered a second time.
      if (reportableType === "User" && !alreadyBlocked) setBlockPromptOpen(true);
    } catch {
      toast.error(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function confirmBlock() {
    setBlocking(true);
    try {
      await blockUser(reportableId);
      toast.success(t("report.block.success"));
      onBlocked?.();
      setBlockPromptOpen(false);
    } catch {
      // The report itself already succeeded and stands — a failed block never
      // rolls it back. Keep the prompt open so they can retry.
      toast.error(t("report.block.error"));
    } finally {
      setBlocking(false);
    }
  }

  return (
    <>
      {/* The shared Button primitive, not a bare <button>: as raw inline text this
          trigger was a ~20px-tall tap target, well under a thumb's worth. `ghost`
          + `font-normal` keeps the quiet muted-link look it had, `h-10` gives it a
          real 40px hit box, and the tight `px-2` means a host that squares it off
          into an icon button (the thread header passes `size-10 [&>span]:sr-only`)
          still has room for the flag inside. */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onTrigger}
        {...state}
        className={cn(
          "h-10 gap-1.5 px-2 font-normal text-muted-foreground hover:text-destructive",
          state.className,
          className,
        )}
      >
        {queued ? (
          <Loader2 className="size-4 shrink-0 animate-spin" />
        ) : (
          <Flag className="size-4 shrink-0" />
        )}
        <span>{t("report.title")}</span>
      </Button>

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
              <Textarea
                id={noteId}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder={t("report.notePlaceholder")}
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

      {/* Follow-up: offer to block the person we just reported (users only). */}
      <ConfirmDialog
        open={blockPromptOpen}
        title={t("report.block.title")}
        description={t("report.block.body")}
        confirmLabel={t("report.block.confirmCta")}
        cancelLabel={t("report.block.cancel")}
        destructive
        loading={blocking}
        onConfirm={confirmBlock}
        onCancel={() => setBlockPromptOpen(false)}
      />
    </>
  );
}
