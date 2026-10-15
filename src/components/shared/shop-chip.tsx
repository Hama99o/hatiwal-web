import { useTranslations } from "next-intl";
import { Store } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The small "Shop" label (SHOP-1, docs/SHOPS.md wording). The one place it is
 * drawn: UserIdentity's shop variant and ListingCard reuse it.
 */
export function ShopChip({ className, testId = "shop-chip" }: { className?: string; testId?: string }) {
  const t = useTranslations("shops");
  return (
    <span
      data-testid={testId}
      className={cn("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-primary-soft px-1.5 py-0.5 text-[11px] font-semibold text-primary-ink", className)}
    >
      <Store className="size-3" aria-hidden />
      {t("badge")}
    </span>
  );
}
