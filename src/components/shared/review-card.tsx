import { useLocale } from "next-intl";
import type { Review } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { UserIdentity } from "@/components/shared/user-identity";
import { StarRating } from "@/components/shared/star-rating";

/**
 * One review: reviewer (via the shared UserIdentity — never forked), their
 * star rating, the muted date, and the optional comment. RTL-safe via logical
 * layout; dark mode via token colors.
 */
export function ReviewCard({ review }: { review: Review }) {
  const locale = useLocale();

  return (
    <article className="rounded-lg border bg-card p-4 text-card-foreground">
      <div className="flex items-start justify-between gap-3">
        <UserIdentity
          name={review.reviewer.name}
          avatarUrl={review.reviewer.avatarUrl}
          size={36}
        />
        {/* `formatDate`, not `useFormatter().dateTime`: next-intl formats with
            the raw routing tag, and V8 ships no `ps` data — so every review date
            on /ps came out in ENGLISH ("Jun 30, 2026") beside Pashto text, while
            every other date in the app goes through `fa-AF`. This is exactly the
            `Intl.DateTimeFormat` gap `src/i18n/intl-locale-alias.ts` documents
            as belonging to `format.ts`. */}
        <time
          className="shrink-0 text-xs text-muted-foreground"
          dateTime={review.createdAt}
        >
          {formatDate(review.createdAt, locale)}
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
