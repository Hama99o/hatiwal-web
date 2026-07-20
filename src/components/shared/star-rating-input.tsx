"use client";

import { useRef, useState } from "react";
import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * Interactive 5-star picker (write side of the reviews flow). Filled stars use
 * the gold `warning` token, matching the read-only `StarRating`. Keyboard- and
 * screen-reader-accessible via the ARIA radiogroup pattern: roving tabindex
 * (only the checked star — or star 1 when none — is in the tab order) plus
 * Arrow/Up/Down keys to move the rating. Hover previews the score.
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
  // The single tab-stop for the group (roving tabindex): the checked star, or
  // star 1 when nothing is selected yet.
  const tabStop = value || 1;
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: React.KeyboardEvent, n: number) {
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = Math.min(5, n + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown")
      next = Math.max(1, n - 1);
    if (next == null) return;
    e.preventDefault();
    onChange(next);
    btnRefs.current[next - 1]?.focus();
  }

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
          ref={(el) => {
            btnRefs.current[n - 1] = el;
          }}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={t("starsAria", { rating: n })}
          tabIndex={n === tabStop ? 0 : -1}
          onClick={() => onChange(n)}
          onKeyDown={(e) => onKeyDown(e, n)}
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
