"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Check, ChevronRight, Circle, Hourglass, IdCard, ShieldAlert, ShieldCheck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/components/auth/auth-provider";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  cancelVerification,
  getVerificationStatus,
  verificationReasonKey,
  VERIFICATION_QK,
} from "@/lib/api/verification";

/**
 * VER-1 status card on the profile (docs/VERIFICATION.md "Status, everywhere
 * the same"): Get verified / what is missing / under review / verified /
 * rejected + reason + Try again / revoked + reason + Apply again.
 * Same states and testids as mobile's VerificationCard. Never shows a document.
 */
export function VerificationCard() {
  const t = useTranslations("verify");
  const tp = useTranslations("profile");
  const locale = useLocale();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: VERIFICATION_QK,
    queryFn: () => getVerificationStatus(),
    enabled: !!user,
  });

  const cancel = useMutation({
    mutationFn: (id: number) => cancelVerification(id),
    onSuccess: (status) => {
      qc.setQueryData(VERIFICATION_QK, status);
      setConfirmCancel(false);
    },
  });

  if (!user) return null;

  const shell = "space-y-3 rounded-lg border bg-card p-4";

  if (isLoading) {
    return (
      <div className={shell} data-testid="verify-card-loading">
        <Skeleton className="h-5 w-3/5" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <button type="button" onClick={() => refetch()} className={`${shell} w-full text-start text-sm text-muted-foreground`} data-testid="verify-card-error">
        {t("card.loadError")} {t("tryAgain")}
      </button>
    );
  }

  const status = data.status;
  const reasonKey = verificationReasonKey(data);
  const reason = reasonKey && t.has(reasonKey) ? t(reasonKey) : data.reason;

  const heading = (icon: React.ReactNode, title: string) => (
    <div className="flex items-center gap-2.5">
      {icon}
      <h2 className="flex-1 text-[15px] font-bold" data-testid={`verify-card-status-${status}`}>
        {title}
      </h2>
    </div>
  );

  let body: React.ReactNode;

  if (status === "verified") {
    body = heading(
      <BadgeCheck className="size-6 text-primary" />,
      data.verifiedSince ? t("card.verified", { date: formatDate(data.verifiedSince, locale) }) : t("card.verifiedNoDate"),
    );
  } else if (status === "requested") {
    const request = data.request;
    body = (
      <>
        {heading(
          <Hourglass className="size-5 text-warning" />,
          t("card.requested", { date: formatDate(request?.createdAt, locale) }),
        )}
        <p className="text-sm text-muted-foreground">
          {t("underReview")}
          {request ? ` · ${t("card.photosSent", { count: request.filesCount })}` : ""}
        </p>
        {request && (
          <>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmCancel(true)} data-testid="verify-cancel">
              {t("card.cancel")}
            </Button>
            <ConfirmDialog
              open={confirmCancel}
              title={t("card.cancelTitle")}
              description={t("card.cancelBody")}
              confirmLabel={t("card.cancelConfirm")}
              cancelLabel={t("card.keep")}
              destructive
              loading={cancel.isPending}
              onConfirm={() => cancel.mutate(request.id)}
              onCancel={() => setConfirmCancel(false)}
            />
          </>
        )}
      </>
    );
  } else if (status === "rejected" || status === "revoked") {
    body = (
      <>
        {heading(<ShieldAlert className="size-5 text-destructive" />, t(status === "rejected" ? "card.rejected" : "card.revoked"))}
        {reason && (
          <p className="rounded-md bg-destructive/10 p-3 text-sm" data-testid="verify-card-reason" dir="auto">
            {reason}
          </p>
        )}
        <Button asChild className="w-full" data-testid="verify-start">
          <Link href="/profile/verify">{t(status === "rejected" ? "tryAgain" : "applyAgain")}</Link>
        </Button>
      </>
    );
  } else if (data.missing.length > 0) {
    body = (
      <>
        {heading(<ShieldCheck className="size-6 text-primary" />, t("title"))}
        <p className="text-sm text-muted-foreground">{t("card.missingTitle")}</p>
        <ul className="space-y-2">
          {data.missing.map((key) => (
            <li key={key} className="flex items-center gap-2 text-sm" data-testid={`verify-missing-${key}`}>
              <Circle className="size-3.5 text-muted-foreground" />
              {t(`missing.${key}`)}
            </li>
          ))}
        </ul>
        {data.missing.some((k) => k !== "email_confirmed") && (
          <Button asChild variant="outline" className="w-full" data-testid="verify-fix-profile">
            <Link href="/profile/edit">{tp("edit.title")}</Link>
          </Button>
        )}
      </>
    );
  } else {
    // Eligible: LinkedIn pattern — avatar with a shield, 3 ticks, one row.
    const name = user.fullName || `${user.firstname} ${user.lastname}`.trim();
    body = (
      <>
        <div className="flex items-center gap-3">
          <div className="relative">
            <UserAvatar name={name} avatarUrl={user.avatarUrl} size={48} />
            <span className="absolute -bottom-0.5 -end-0.5 rounded-full bg-card p-0.5">
              <ShieldCheck className="size-[18px] text-primary" />
            </span>
          </div>
          <h2 className="flex-1 text-base font-bold" data-testid="verify-card-status-none">
            {data.nameChanged ? t("card.nameChanged") : t("title")}
          </h2>
        </div>
        <ul className="space-y-2">
          {(["trust", "faster", "name"] as const).map((key) => (
            <li key={key} className="flex items-center gap-2 text-sm">
              <Check className="size-4 text-success" />
              {t(`benefits.${key}`)}
            </li>
          ))}
        </ul>
        <Link
          href="/profile/verify"
          data-testid="verify-start"
          className="flex items-center gap-2.5 rounded-lg border px-3 py-3 text-sm font-semibold transition-colors hover:bg-accent"
        >
          <IdCard className="size-5 text-primary" />
          <span className="flex-1">{t("withTazkira")}</span>
          <ChevronRight className="size-4 text-muted-foreground rtl:-scale-x-100" />
        </Link>
      </>
    );
  }

  return (
    <section className={shell} data-testid="verify-card">
      {body}
    </section>
  );
}
