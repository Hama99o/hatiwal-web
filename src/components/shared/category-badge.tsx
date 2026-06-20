import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { categoryName } from "@/lib/api/categories";
import { cn } from "@/lib/utils";
import type { Category, CategoryRef } from "@/lib/types";

interface CategoryBadgeProps {
  category: Category | CategoryRef;
  asLink?: boolean;
  className?: string;
}

export function CategoryBadge({
  category,
  asLink = false,
  className,
}: CategoryBadgeProps) {
  const locale = useLocale();
  const name = categoryName(category, locale);
  const icon = "icon" in category ? category.icon : undefined;

  const content = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-medium text-foreground transition-colors hover:bg-accent",
        className,
      )}
    >
      {icon ? <span aria-hidden>{icon}</span> : null}
      {name}
    </span>
  );

  if (asLink) {
    return <Link href={`/categories/${category.slug}`}>{content}</Link>;
  }
  return content;
}
