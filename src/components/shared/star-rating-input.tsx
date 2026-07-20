"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * Interactive 5-star picker (write side of the reviews flow). Filled stars use
 * the gold `warning` token, matching the read-only `StarRating`. Keyboard- and
 * screen-reader-accessible via a radiogroup; hover previews the score. RTL-safe
 * — the row is symmetric so it reads 1→5 outward in either direction.
 */
export function StarRatingInput({
  value,
  onChange,
  size = 32,
  className,
}: {
  value: number;
  onChange: (rating: number) => void;
  size?: number;
  className?: string;
}) {
  const t = useTranslations("reviews");
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <div
      role="radiogroup"
      aria-label={t("ratingLabel")}
      className={cn("flex items-center gap-1", className)}
      onMouseLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={t("starsAria", { rating: n })}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          className="rounded p-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Star
            style={{ width: size, height: size }}
            className={cn(
              "shrink-0 transition-colors",
              n <= shown
                ? "fill-warning text-warning"
                : // Outline (no fill) in a mid-muted tone so empty stars are
                  // clearly visible/clickable on a white card, not near-invisible.
                  "fill-transparent text-muted-foreground/50",
            )}
            aria-hidden
          />
        </button>
      ))}
    </div>
  );
}
