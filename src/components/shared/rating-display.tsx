import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * Compact rating summary — one gold star + the average (hero) + the review
 * count (secondary). Web port of the mobile `RatingDisplay`, same empty rule:
 * with no revealed reviews it shows a neutral "No reviews yet" so a new seller
 * reads as *new*, not *bad*. `lg` is the profile-header hero; `sm` sits inline.
 */
export function RatingDisplay({
  avgRating,
  reviewCount = 0,
  size = "sm",
  className,
}: {
  avgRating?: number | null;
  reviewCount?: number;
  size?: "sm" | "lg";
  className?: string;
}) {
  const t = useTranslations("reviews");
  const lg = size === "lg";
  const hasReviews = reviewCount > 0 && avgRating != null;

  if (!hasReviews) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 text-muted-foreground",
          lg ? "text-sm" : "text-xs",
          className,
        )}
      >
        <Star
          className={cn("shrink-0 fill-muted text-muted", lg ? "size-5" : "size-4")}
          aria-hidden
        />
        <span>{t("empty")}</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Star
        className={cn("shrink-0 fill-warning text-warning", lg ? "size-5" : "size-4")}
        aria-hidden
      />
      <span
        className={cn("font-bold text-foreground", lg ? "text-xl" : "text-sm")}
      >
        {avgRating!.toFixed(1)}
      </span>
      <span className={cn("text-muted-foreground", lg ? "text-sm" : "text-xs")}>
        {t("reviewCount", { count: reviewCount })}
      </span>
    </div>
  );
}
