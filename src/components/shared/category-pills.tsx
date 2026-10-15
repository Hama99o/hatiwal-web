import { Link } from "@/i18n/navigation";
import { categoryName } from "@/lib/api/categories";
import type { Category } from "@/lib/types";

/**
 * One row of category pills (icon + name) with a heading and a "View all" link —
 * the home page's category section (docs/design/home.md) and the way forward
 * from an empty search (docs/design/search.md). Sideways scroll on phones (edge
 * to edge, no scrollbar), wraps from `sm`. No hooks, so it renders in server and
 * client trees alike; the caller passes the translated labels.
 */
export function CategoryPills({
  categories,
  locale,
  heading,
  viewAllLabel,
  headingId,
  size = "lg",
}: {
  categories: Category[];
  locale: string;
  heading: string;
  viewAllLabel: string;
  headingId: string;
  /** `lg` = a page section heading; `sm` = inside another block (empty state). */
  size?: "lg" | "sm";
}) {
  if (categories.length === 0) return null;
  return (
    <section className="space-y-3" aria-labelledby={headingId}>
      <div className="flex items-baseline justify-between gap-4">
        <h2
          id={headingId}
          className={size === "lg" ? "text-xl font-bold tracking-tight sm:text-2xl" : "text-base font-semibold"}
        >
          {heading}
        </h2>
        <Link href="/categories" className="text-sm font-medium text-primary hover:underline">
          {viewAllLabel}
        </Link>
      </div>
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {categories.map((category) => (
          <li key={category.id} className="shrink-0">
            <Link
              href={`/categories/${category.slug}`}
              className="flex h-11 items-center gap-2 rounded-full border bg-card ps-3 pe-4 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span aria-hidden className="text-lg leading-none">
                {category.icon ?? "📦"}
              </span>
              {categoryName(category, locale)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
