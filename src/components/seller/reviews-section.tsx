"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Star, Store, ShoppingBag } from "lucide-react";
import { getUserReviews } from "@/lib/api/reviews";
import type { ReviewRole } from "@/lib/types";
import { RatingDisplay } from "@/components/shared/rating-display";
import { ReviewCard } from "@/components/shared/review-card";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Ratings & Reviews on the public seller profile (REV3, mobile parity). The
 * `avgRating`/`reviewCount` summary is server-provided (guest-safe, from the
 * public profile); the review LIST is lazy-loaded per role via TanStack Query,
 * mirroring `SellerListingsTabs`. Only VISIBLE (double-blind–revealed) reviews
 * are ever returned by the backend.
 */
export function ReviewsSection({
  sellerId,
  avgRating,
  reviewCount = 0,
}: {
  sellerId: number;
  avgRating?: number | null;
  reviewCount?: number;
}) {
  const t = useTranslations("reviews");
  const [role, setRole] = useState<ReviewRole>("of_seller");

  const { data, isPending, isError } = useQuery({
    queryKey: ["seller-reviews", sellerId, role],
    queryFn: () => getUserReviews(sellerId, { role }),
  });

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">
          {t("sectionTitle")}
        </h2>
        <RatingDisplay avgRating={avgRating} reviewCount={reviewCount} size="lg" />
      </div>

      <SegmentedControl<ReviewRole>
        className="mt-4 max-w-sm"
        fullWidth
        ariaLabel={t("tabsLabel")}
        value={role}
        onChange={setRole}
        options={[
          { value: "of_seller", label: t("asSeller"), icon: Store },
          { value: "of_buyer", label: t("asBuyer"), icon: ShoppingBag },
        ]}
      />

      <div className="mt-6">
        {isError ? (
          <EmptyState icon={Star} title={t("empty")} description={t("emptyDescription")} />
        ) : isPending ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((n) => (
              <Skeleton key={n} className="h-28 w-full rounded-lg" />
            ))}
          </div>
        ) : data && data.items.length > 0 ? (
          <div className="flex flex-col gap-3">
            {data.items.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        ) : (
          <EmptyState icon={Star} title={t("empty")} description={t("emptyDescription")} />
        )}
      </div>
    </section>
  );
}
