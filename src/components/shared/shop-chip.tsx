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
      className={cn("inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10.5px] font-bold text-primary", className)}
    >
      <Store className="size-3" aria-hidden />
      {t("badge")}
    </span>
  );
}
