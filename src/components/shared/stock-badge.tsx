import { useTranslations } from "next-intl";
import { Boxes } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  availableUnitsOf,
  totalUnitsOf,
  isLowStock,
  hasStockToShow,
  hasSoldSome,
  heldUnitsOf,
  heldForBuyer,
} from "@/lib/stock";
import type { Listing } from "@/lib/types";

type StockFields = Pick<
  Listing,
  "quantity" | "availableUnits" | "multiUnit" | "heldUnits" | "sale"
>;

/**
 * StockBadge — "12 in stock" / "2 of 15 left" (docs/SPIKE_LISTING_QUANTITY.md).
 *
 * Mirrors mobile's inline stock pill on ListingDetail/MyListingDetail, and
 * deliberately reuses FirmPriceBadge's quiet treatment rather than inventing a
 * visual language: it is a qualifier on the price, not a promotion.
 *
 * Renders NOTHING for a single-item listing — the spike's governing rule is that
 * a seller with one item never sees that this feature exists, and that has to
 * hold structurally, not by copy.
 *
 * `owner` picks the phrasing. A buyer wants the remainder ("12 in stock"); the
 * seller wants progress through their batch ("12 of 15 left"), because their
 * question is "how do I know when they're all gone?".
 *
 * ── The HELD clause ─────────────────────────────────────────────────────────
 *
 * When units are promised to one buyer, the pill says so: "12 in stock · 2 held"
 * for a buyer, "12 of 15 left · 2 held for Ahmad" for the owner. The buyer's
 * NAME is owner-only — it comes off the owner-scoped `sale` block, never off the
 * public `heldUnits` count, which carries no identity by design.
 *
 * Held units are advisory: they are NOT subtracted from what is available, so
 * another buyer can still ask about them. That is deliberate — with no payment
 * step there is nothing to enforce a real hold with, and a deal falling through
 * is the normal case, not the exception. Saying "2 held" is honesty about the
 * state of play, not a claim that inventory has been set aside.
 */
export function StockBadge({
  listing,
  owner = false,
  className,
}: {
  listing: StockFields | null | undefined;
  owner?: boolean;
  className?: string;
}) {
  const t = useTranslations("listing.stock");

  if (!hasStockToShow(listing)) return null;

  const available = availableUnitsOf(listing);
  const total = totalUnitsOf(listing);
  const low = isLowStock(available, total);
  const held = heldUnitsOf(listing);
  // Owner-only, and only when the hold actually records who it is for.
  const heldBuyerName = owner ? (heldForBuyer(listing)?.name ?? null) : null;

  // Amber only when genuinely running out — the same token a reserved listing
  // already uses, never a new colour. Everything else stays neutral.
  const variant = low ? "warning" : "muted";

  return (
    <Badge variant={variant} className={cn("gap-1", className)}>
      <Boxes className="size-3" />
      {/* Raw numbers, not pre-formatted strings: the catalog declares these as
          typed ICU `{x, number}` placeholders, so next-intl localizes the digits
          itself (ps included, via the fa-AF Intl alias). */}
      {/* The owner gets the progress phrasing ("11 of 15 left") — but only once
          there IS progress. On a batch nobody has bought from, "15 of 15 left"
          just repeats itself, so they get the plain count like a buyer (UI-009).
          A low-stock listing always shows both numbers: "2 left" means more when
          you can see it was 15. */}
      {(owner && hasSoldSome(listing)) || low
        ? t("leftOfTotal", { available, total })
        : t("inStock", { count: available })}
      {/* "· 2 held" / "· 2 held for Ahmad". A separate clause rather than a
          fourth whole-pill phrasing: availability and a hold are two different
          facts, and folding them into one sentence per combination would need
          six strings translated three ways to say the same two things. */}
      {held > 0 && (
        <span className="text-muted-foreground">
          {"· "}
          {heldBuyerName
            ? t("heldForBuyer", { count: held, name: heldBuyerName })
            : t("held", { count: held })}
        </span>
      )}
    </Badge>
  );
}
