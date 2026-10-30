"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronRight, Sparkles, X } from "lucide-react";
import { CategoryBadge } from "@/components/shared/category-badge";
import { categoryName } from "@/lib/api/categories";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Sell with a photo (hatiwal-mobile docs/design/SELL_WITH_PHOTO.md §3): one
 * row under the photos — "✨ Looks like: Electronics › [📱 Phones & Tablets]  ✕".
 * The row is the accept button; ✕ (a plain muted icon, house rule) dismisses.
 *
 * It opens and closes by height (grid rows 0fr ⇄ 1fr) with the house fade, so
 * nothing below it jumps; while closing it keeps showing the last suggestion.
 * The category names are the category's own, in the page's language.
 */
export function CategorySuggestionChip({
  shown,
  onAccept,
  onDismiss,
}: {
  shown: { category: Category; parent: Category | null } | null;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const t = useTranslations("listing.form.suggestion");
  const locale = useLocale();
  const [last, setLast] = useState(shown);
  useEffect(() => {
    if (shown) setLast(shown);
  }, [shown]);

  const open = shown !== null;
  const content = shown ?? last;
  const name = content ? categoryName(content.category, locale) : "";

  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}
      aria-hidden={!open}
      inert={!open}
    >
      <div className="overflow-hidden">
        {content ? (
          <div
            data-testid={open ? "category-suggestion" : undefined}
            className={cn(
              "flex items-center gap-1 rounded-lg border border-border bg-secondary/60",
              open && "animate-fade-in-up",
            )}
          >
            <button
              type="button"
              data-testid="category-suggestion-accept"
              onClick={onAccept}
              aria-label={t("use", { name })}
              className="flex min-h-11 flex-1 flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-3 py-2 text-start text-sm transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Sparkles className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="text-muted-foreground">{t("looksLike")}</span>
              {content.parent ? (
                <span className="inline-flex items-center gap-1 font-medium text-foreground">
                  <bdi>{categoryName(content.parent, locale)}</bdi>
                  <ChevronRight className="size-3.5 text-muted-foreground rtl:rotate-180" aria-hidden />
                </span>
              ) : null}
              <CategoryBadge category={content.category} className="pointer-events-none bg-background" />
            </button>
            <button
              type="button"
              data-testid="category-suggestion-dismiss"
              onClick={onDismiss}
              aria-label={t("dismiss")}
              className="me-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
