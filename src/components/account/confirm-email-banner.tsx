"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MailWarning, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { resendConfirmation } from "@/lib/api/me";

/**
 * "Confirm your email", with a resend action — the web half of the prompt that
 * mobile also grew.
 *
 * The API has had Devise `:confirmable` on for a while with nothing gated on it,
 * because no client could tell a confirmed account from an unconfirmed one and
 * none could ask for the mail again (hatiwal-api docs/EMAIL_CONFIRMATION.md).
 * Resend is the part that makes it worth having: a confirmation email that lands
 * in spam otherwise strands the account for good.
 *
 * NON-BLOCKING, matching the API, where `allow_unconfirmed_access_for` is nil: an
 * unconfirmed user keeps full access. This informs and offers a way forward; it
 * does not stand in anyone's way.
 */
export function ConfirmEmailBanner({
  email,
  confirmed,
}: {
  email?: string | null;
  /** Undefined on an older API build — treated as confirmed, so the prompt never
   *  shows for someone who has no way to act on it. */
  confirmed?: boolean;
}) {
  const t = useTranslations();
  const [sending, setSending] = useState(false);

  // Resend needs an address to send to; without one this would be a dead end.
  if (confirmed !== false || !email) return null;

  async function resend() {
    if (sending) return;
    setSending(true);
    try {
      await resendConfirmation(email!);
      toast.success(t("auth.confirmEmail.sent"));
    } catch {
      // Never fail silently here: the user would wait for a mail that is not
      // coming, with no reason to try again.
      toast.error(t("auth.confirmEmail.failed"));
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      data-testid="confirm-email-banner"
      className="mb-4 rounded-xl border border-amber-300/60 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10"
    >
      <div className="flex items-center gap-2">
        <MailWarning className="size-4 shrink-0 text-amber-700 dark:text-amber-400" />
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          {t("auth.confirmEmail.title")}
        </p>
      </div>

      <p className="mt-1 text-xs text-amber-800/90 dark:text-amber-200/80">
        {t("auth.confirmEmail.body", { email })}
      </p>

      <button
        type="button"
        onClick={resend}
        disabled={sending}
        data-testid="confirm-email-resend"
        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-400/70 px-3 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-100 disabled:opacity-60 dark:text-amber-200 dark:hover:bg-amber-500/15"
      >
        {sending && <Loader2 className="size-4 animate-spin" />}
        {sending ? t("auth.confirmEmail.sending") : t("auth.confirmEmail.resend")}
      </button>
    </div>
  );
}

export default ConfirmEmailBanner;
