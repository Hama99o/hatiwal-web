"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { BadgeCheck, Circle, Hourglass, ShieldAlert } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { getVerificationStatus, shopVerificationQK, verificationReasonKey } from "@/lib/api/verification";

/** SHOP-1: "Get the Verified shop ✓ badge" on the owner's shop page (same states as mobile). */
/** The owner's and managers' card (staff never get it: shop-page-view, 2026-10-08). */
export function ShopVerificationCard({ shopId }: { shopId: number }) {
  const t = useTranslations("verify");
  // Refetched on every mount: what's "missing" (a live product, the logo, the
  // pin) changes on other screens — a product posted, published, moved or
  // deleted — and the global 60 s staleTime kept a stale "Post at least 1
  // product first" beside "Products (1)" (d8). One small GET per shop-page visit.
  const { data } = useQuery({
    queryKey: shopVerificationQK(shopId),
    queryFn: () => getVerificationStatus(`shop:${shopId}`),
    refetchOnMount: "always",
  });
  if (!data || data.status === "verified") return null;

  const shell = "space-y-3 rounded-lg border bg-card p-4";
  const head = (Icon: typeof BadgeCheck, tone: string, title: string) => (
    <p className="flex items-center gap-2 font-bold" data-testid={`shop-verify-card-status-${data.status}`}>
      <Icon className={`size-5 ${tone}`} /> {title}
    </p>
  );
  const start = (label: string) => (
    <Button asChild className="w-full" data-testid="shop-verify-start">
      <Link href={`/shops/${shopId}/verify`}>{label}</Link>
    </Button>
  );

  if (data.status === "requested") return <div className={shell} data-testid="shop-verify-card">{head(Hourglass, "text-warning", t("underReview"))}</div>;
  if (data.status === "rejected" || data.status === "revoked") {
    const key = verificationReasonKey(data);
    const reason = key && t.has(key) ? t(key) : data.reason;
    return (
      <div className={shell} data-testid="shop-verify-card">
        {head(ShieldAlert, "text-destructive", t("shop.rejected"))}
        {reason && <p className="text-sm" dir="auto" data-testid="shop-verify-card-reason">{reason}</p>}
        {start(t("tryAgain"))}
      </div>
    );
  }
  return (
    <div className={shell} data-testid="shop-verify-card">
      {head(BadgeCheck, "text-primary", t("shop.cardTitle"))}
      {data.missing.length > 0 ? (
        <>
          <p className="text-sm text-muted-foreground">{t("shop.missingTitle")}</p>
          <ul className="space-y-1.5">
            {data.missing.map((k) => (
              <li key={k} className="flex items-center gap-2 text-sm" data-testid={`shop-verify-missing-${k}`}>
                <Circle className="size-3.5 text-muted-foreground" /> {t(`shop.missing.${k}`)}
              </li>
            ))}
          </ul>
        </>
      ) : (
        start(t("cta"))
      )}
    </div>
  );
}
