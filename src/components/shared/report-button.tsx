"use client";

import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { useLoginHref } from "@/components/auth/login-href";
import { useIsOwner, useServerViewerId } from "@/components/auth/owner-gate";
import {
  createReport,
  type ReportableType,
  type ReportReason,
} from "@/lib/api/reports";
import { blockUser, getBlockedUsers } from "@/lib/api/chat";
import { ApiError } from "@/lib/api/client";
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
 * Name the report failure. Rails answers **422 for two very different things** —
 * "you have already reported this" and "you cannot report your own content" — so
 * the status alone can't pick a message, and the reporter used to be told only
 * `common.error` ("Something went wrong") when in fact nothing had gone wrong:
 * their earlier report was already on file. The reasons come out of the response
 * body (`ApiError.errors` = Rails' `full_messages`), matched on the same
 * substrings as mobile's ReportSheet so both clients name the same failure.
 *
 * `raw` is an unmatched 422 reason passed through verbatim (mobile does the
 * same): a specific server sentence beats a generic apology, and inventing a
 * translated key per validation Rails might add is not maintainable.
 */
function reportFailure(err: unknown): { key: string; raw?: string } {
  if (!(err instanceof ApiError) || err.status !== 422) {
    return { key: "report.errors.generic" };
  }
  const joined = err.errors.join(" ").toLowerCase();
  if (joined.includes("own") || joined.includes("yourself")) {
    return { key: "report.errors.selfReport" };
  }
  if (joined.includes("already") || joined.includes("duplicate")) {
    return { key: "report.errors.duplicate" };
  }
  return { key: "report.errors.generic", raw: err.errors[0] };
}

/**
 * Report a listing or a user. Mirrors the mobile ReportSheet. Guests are sent
 * to sign in; hidden on your own listing/profile. Reuses the existing `report`
 * translation namespace (all 3 locales).
 *
 * After a successful **User** report it closes the loop the same way mobile's
 * ReportSheet does (TASK-R612): the reporter is offered a follow-up confirm to
 * also block that person, so "this user is abusive" and "stop them contacting
 * me" are one flow. A **Listing** report never prompts.
 *
 * "Already blocked?" is answered HERE, from the shared `["blocked-users"]`
 * query (`GET /blocks` = the people *I* have blocked), so the follow-up behaves
 * identically on the listing page, the seller profile and the chat header. It
 * used to be a prop the host filled in, and the only host that filled it passed
 * the conversation's `blockedWithParticipant` — which Rails computes as
 * `me.blocked?(them) || them.blocked?(me)`. Someone who had blocked *me* read as
 * "already blocked", so reporting the person harassing you silently skipped the
 * offer to block them back: the exact case this feature exists for.
 */
export function ReportButton({
  reportableType,
  reportableId,
  ownerId,
  className,
  onBlocked,
}: {
  reportableType: ReportableType;
  reportableId: number;
  /** Owner of the reported thing — used to hide the button on your own content. */
  ownerId?: number;
  className?: string;
  /**
   * Called after a successful block from the follow-up prompt, so a host that
   * owns its own block state (the conversation thread header) can flip its
   * shield icon without waiting for a refetch. Never called on cancel or on
   * failure.
   */
  onBlocked?: () => void;
}) {
  const t = useTranslations();
  const qc = useQueryClient();
  const router = useRouter();
  const loginHref = useLoginHref();
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
  const [blockPromptOpen, setBlockPromptOpen] = useState(false);
  const titleId = useId();
  const noteId = useId();

  // Who the viewer has already blocked, from the one shared cache the blocked-
  // users setting page also reads. Fetched only once the dialog is open — a
  // control that most visitors never touch must not cost every page load an
  // extra authed request — and never for a listing report, which has no
  // follow-up. Not settled yet (or failed) means "not blocked": over-offering is
  // recoverable and `POST /users/:id/block` is idempotent server-side, whereas
  // wrongly staying silent loses the block the reporter came for.
  const isUserReport = reportableType === "User";
  const blockedQ = useQuery({
    queryKey: ["blocked-users"],
    queryFn: getBlockedUsers,
    enabled: isUserReport && open && status === "authed",
  });
  const alreadyBlocked = (blockedQ.data ?? []).some(
    (u) => u.id === reportableId,
  );

  // Both writes are React Query mutations, like every other write in the app —
  // that is what gives the block a single place to invalidate from, so no other
  // screen keeps serving a 60s-stale "not blocked" for someone the viewer just
  // blocked.
  const reportM = useMutation({
    mutationFn: (input: { reason: ReportReason; description?: string }) =>
      createReport({ reportableType, reportableId, ...input }),
    onSuccess: () => {
      toast.success(t("report.success"));
      setOpen(false);
      setReason(null);
      setNote("");
      // Reporting a person → offer to also block them. Reporting a listing
      // keeps the original behaviour (success toast, no prompt), and someone
      // already blocked is never offered a second time.
      if (isUserReport && !alreadyBlocked) setBlockPromptOpen(true);
    },
    onError: (err) => {
      const { key, raw } = reportFailure(err);
      toast.error(raw ?? t(key));
    },
  });

  const blockM = useMutation({
    mutationFn: () => blockUser(reportableId),
    onSuccess: () => {
      toast.success(t("report.block.success"));
      onBlocked?.();
      setBlockPromptOpen(false);
      // Everything that encodes "can this person reach me" is now wrong: the
      // blocked-users setting list, the inbox rows and any cached thread.
      qc.invalidateQueries({ queryKey: ["blocked-users"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["conversation"] });
    },
    onError: () => {
      // The report itself already succeeded and stands — a failed block never
      // rolls it back. Keep the prompt open so they can retry.
      toast.error(t("report.block.error"));
    },
  });

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
      router.push(loginHref());
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
      router.push(loginHref());
      return;
    }
    setOpen(true);
  }

  // A labelled control, so the cue is the GLYPH it already renders and never the
  // colour of the label (the trigger is `text-muted-foreground` at its readable
  // floor; dimming it further would fail AA) and never opacity — see
  // lib/unsettled.ts for why, and for the numbers. `Flag` → `Loader2` costs
  // nothing, survives `prefers-reduced-motion`, and matches the primary CTA on the
  // same page, because that module decides it for both. `aria-busy` carries the
  // same state for assistive tech.
  const state = unsettledProps({ unknown: unsettled, busy: queued });

  function submit() {
    if (!reason) {
      toast.error(t("report.reasonRequired"));
      return;
    }
    reportM.mutate({ reason, description: note.trim() || undefined });
  }

  const busy = reportM.isPending;

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
          className,
        )}
      >
        {unsettled || queued ? (
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
        loading={blockM.isPending}
        onConfirm={() => blockM.mutate()}
        onCancel={() => setBlockPromptOpen(false)}
      />
    </>
  );
}
