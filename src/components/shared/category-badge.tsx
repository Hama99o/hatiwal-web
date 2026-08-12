import { cva, type VariantProps } from "class-variance-authority";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { categoryName } from "@/lib/api/categories";
import { cn } from "@/lib/utils";
import type { Category, CategoryRef } from "@/lib/types";

/**
 * The one chip recipe for "a category" across the app — the listing detail
 * breadcrumb, the category hub, and the drill-down chip rows all render from
 * this, so a category never looks like two different things.
 *
 * `size="touch"` meets the 44px minimum tap target (matches mobile's
 * SubcategoryPanel chips); `tone="empty"` is the de-emphasised treatment for a
 * category with no active listings.
 */
export const categoryBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors",
  {
    variants: {
      size: {
        default: "px-3 py-1 text-sm",
        touch: "min-h-11 px-3.5 py-2 text-sm",
      },
      tone: {
        default:
          "border-transparent bg-muted text-foreground hover:bg-accent hover:text-accent-foreground",
        active: "border-transparent bg-primary text-primary-foreground",
        empty:
          "border-dashed border-border bg-transparent text-muted-foreground hover:bg-muted",
      },
    },
    defaultVariants: { size: "default", tone: "default" },
  },
);

interface CategoryBadgeProps extends VariantProps<typeof categoryBadgeVariants> {
  category: Category | CategoryRef;
  asLink?: boolean;
  /**
   * Active listing count for this category. A count above zero is rendered
   * next to the name so a chip is never a blind click. Zero is carried by
   * `tone="empty"` plus the accessible name / tooltip instead of printed on the
   * chip: a row of children is usually all-empty (sellers file on the top-level
   * category), and repeating the same sentence across every chip reads as a
   * wall of dead ends rather than as one de-emphasised group.
   */
  count?: number;
  /** Marks the chip for the category the viewer is already looking at. */
  current?: boolean;
  className?: string;
}

export function CategoryBadge({
  category,
  asLink = false,
  count,
  current = false,
  size,
  tone,
  className,
}: CategoryBadgeProps) {
  const locale = useLocale();
  const t = useTranslations();
  const name = categoryName(category, locale);
  const icon = "icon" in category ? category.icon : undefined;
  const hasCount = typeof count === "number";
  // Never a bare "0" — an empty category says so, in words, wherever the count
  // is spelled out (accessible name + hover tooltip).
  const countLabel = hasCount
    ? count > 0
      ? t("listing.shopCount", { count })
      : t("categoriesPage.noListings")
    : undefined;
  const ariaCurrent = current ? "page" : undefined;

  const content = (
    <span
      className={cn(categoryBadgeVariants({ size, tone }), className)}
      title={hasCount && count === 0 ? countLabel : undefined}
      // On the non-link (current) chip this is the element that carries the
      // state; inside a link the <Link> below owns it and this is undefined.
      aria-current={asLink ? undefined : ariaCurrent}
    >
      {icon ? <span aria-hidden>{icon}</span> : null}
      {name}
      {hasCount && count > 0 ? (
        <span className="text-xs font-semibold tabular-nums">{count}</span>
      ) : null}
    </span>
  );

  if (asLink) {
    return (
      <Link
        href={`/categories/${category.slug}`}
        // Spell the count out for screen readers — the bare number next to the
        // name has no meaning without it, and an empty chip's dashed border
        // says nothing at all.
        aria-label={countLabel ? `${name} — ${countLabel}` : name}
        aria-current={ariaCurrent}
        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {content}
      </Link>
    );
  }
  return content;
}
