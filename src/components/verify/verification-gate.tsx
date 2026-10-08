"use client";

/**
 * In front of the apply flow (/profile/verify, /shops/<id>/verify): the flow
 * only starts when the CURRENT state allows applying (owner, 2026-10-08;
 * mobile VerificationGate). Decided on the server's FIRST answer:
 *   - staff of a shop (canApply false) → back to the shop page, no form;
 *   - a request under review → "Under review · sent <date>", no form;
 *   - already verified → "Verified ✓", no form;
 *   - none / rejected / revoked → the flow.
 * A submit inside the flow updates the same query; the flow's own Under review
 * screen stays (the decision is not re-taken).
 */
import { useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Hourglass } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDate } from "@/lib/format";
import {
  getVerificationStatus,
  shopVerificationQK,
  VERIFICATION_QK,
  type VerificationStatus,
} from "@/lib/api/verification";

type Decision = "flow" | "requested" | "verified" | "denied";

export function decideVerificationGate(status: VerificationStatus): Decision {
  if (!status.canApply) return "denied";
  if (status.status === "requested") return "requested";
  if (status.status === "verified") return "verified";
  return "flow";
}

export function VerificationGate({ shopId, children }: { shopId?: number; children: React.ReactNode }) {
  const forShop = typeof shopId === "number";
  const t = useTranslations("verify");
  const tRoot = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { data, isFetchedAfterMount, isError } = useQuery({
    queryKey: forShop ? shopVerificationQK(shopId) : VERIFICATION_QK,
    queryFn: () => getVerificationStatus(forShop ? `shop:${shopId}` : "me"),
    // Ask the server on every visit, whatever the global staleTime.
    refetchOnMount: "always",
  });
  // The server's answer NOW, never a status cached on an earlier page (edge
  // pass 1.1.6, d0: a request sent since, or this member made Staff since).
  // Unreachable: the cached answer, else the flow — never a blank page; the
  // API still refuses a submit it should not take. (Mobile 072fc533/62996634.)
  const decided = useRef<{ decision: Decision; status: VerificationStatus } | null>(null);
  if (data && (isFetchedAfterMount || isError) && !decided.current) {
    decided.current = { decision: decideVerificationGate(data), status: data };
  }
  const gate = decided.current;

  useEffect(() => {
    if (gate?.decision === "denied" && forShop) router.replace(`/shops/${shopId}`);
  }, [gate?.decision, forShop, router, shopId]);

  if (!gate && isError) return <>{children}</>;
  if (!gate || gate.decision === "denied") return <div className="min-h-[50vh]" data-testid="verify-gate-checking" />;
  if (gate.decision === "flow") return <>{children}</>;

  const { status } = gate;
  const requested = gate.decision === "requested";
  const sent = status.request?.createdAt;
  const since = status.verifiedSince;
  const title = requested
    ? sent
      ? t("card.requested", { date: formatDate(sent, locale) })
      : t("underReview")
    : since
      ? t("card.verified", { date: formatDate(since, locale) })
      : t("card.verifiedNoDate");
  return (
    <div className="mx-auto max-w-md px-4 py-16" data-testid={`verify-gate-${gate.decision}`}>
      <EmptyState
        icon={requested ? Hourglass : BadgeCheck}
        title={title}
        description={requested ? t("underReview") : undefined}
        action={{ label: tRoot("common.back"), href: forShop ? `/shops/${shopId}` : "/profile" }}
      />
    </div>
  );
}
