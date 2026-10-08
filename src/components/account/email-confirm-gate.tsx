"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { resendConfirmation } from "@/lib/api/me";
import type { User } from "@/lib/types";

/** Seconds before "Resend email" works again. */
export const RESEND_COOLDOWN_S = 60;

/** The API's refusal for an unconfirmed email (403). */
export const EMAIL_UNCONFIRMED = "email_unconfirmed";

/**
 * Owner, 2026-10-06 (1.1.6): a CONFIRMED email before "Open a shop" and before
 * "Get verified" (person and shop). Shown INSTEAD of the form, so nobody fills a
 * form the API will refuse (403 email_unconfirmed). Web twin of mobile's
 * EmailConfirmGate, same testids. The session user is re-read on focus /
 * visibilitychange, so the gate lifts after the link is opened in another tab.
 * `emailConfirmed` undefined (an older API) counts as confirmed.
 */
export function EmailConfirmGate({ reason, children }: { reason: "shop" | "verify"; children: React.ReactNode }) {
  const t = useTranslations("auth.confirmEmail");
  const tc = useTranslations("common");
  const { user, refresh } = useAuth();
  const blocked = !!user && user.emailConfirmed === false;
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!blocked) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [blocked, refresh]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  if (!blocked) return <>{children}</>;

  const resend = async () => {
    if (sending || cooldown > 0 || !user?.email) return;
    setSending(true);
    try {
      await resendConfirmation(user.email);
      toast.success(t("sent"));
      setCooldown(RESEND_COOLDOWN_S);
    } catch {
      toast.error(t("failed"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 pt-4" data-testid="email-confirm-gate">
    {/* A way back (owner, 2026-10-08: the mobile gate had none; same here, the
        page only offered Resend / Change email). Both entries start on Profile. */}
    <Button asChild variant="ghost" size="sm" className="-ms-2">
      <Link href="/profile" data-testid="email-confirm-gate-back">
        <ArrowLeft className="size-4 rtl:-scale-x-100" />
        {tc("back")}
      </Link>
    </Button>
    <div className="flex flex-col items-center gap-4 pb-16 pt-8 text-center">
      <span className="flex size-18 items-center justify-center rounded-full bg-primary/10">
        <MailCheck className="size-8 text-primary" />
      </span>
      <h1 className="text-xl font-extrabold">{t(reason === "shop" ? "gateTitleShop" : "gateTitleVerify")}</h1>
      <p className="text-muted-foreground">
        {t("gateBody", { email: user!.email ?? "" })}
      </p>
      <Button className="w-full" onClick={resend} disabled={sending || cooldown > 0} data-testid="email-confirm-gate-resend">
        {sending && <Loader2 className="size-4 animate-spin" />}
        {cooldown > 0 ? t("resendIn", { count: cooldown }) : t("resend")}
      </Button>
      <Button asChild variant="outline" className="w-full" data-testid="email-confirm-gate-change">
        <Link href="/profile/edit">{t("changeEmail")}</Link>
      </Button>
    </div>
    </div>
  );
}

/** After a 403 email_unconfirmed: mark the session user so the gate shows. */
export function markEmailUnconfirmed(user: User | null, setUser: (u: User) => void) {
  if (user) setUser({ ...user, emailConfirmed: false });
}
