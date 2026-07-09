import { useFormatter } from "next-intl";
import type { Review } from "@/lib/types";
import { UserIdentity } from "@/components/shared/user-identity";
import { StarRating } from "@/components/shared/star-rating";

/**
 * One review: reviewer (via the shared UserIdentity — never forked), their
 * star rating, the muted date, and the optional comment. RTL-safe via logical
 * layout; dark mode via token colors.
 */
export function ReviewCard({ review }: { review: Review }) {
  const format = useFormatter();

  return (
    <article className="rounded-lg border bg-card p-4 text-card-foreground">
      <div className="flex items-start justify-between gap-3">
        <UserIdentity
          name={review.reviewer.name}
          avatarUrl={review.reviewer.avatarUrl}
          size={36}
        />
        <time
          className="shrink-0 text-xs text-muted-foreground"
          dateTime={review.createdAt}
        >
          {format.dateTime(new Date(review.createdAt), {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </time>
      </div>
      <StarRating rating={review.rating} className="mt-3" />
      {review.comment ? (
        <p className="mt-2 text-sm leading-relaxed text-foreground">
          {review.comment}
        </p>
      ) : null}
    </article>
  );
}
