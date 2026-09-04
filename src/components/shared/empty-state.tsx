import type { LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EmptyStateAction =
  | { label: string; href: string }
  | { label: string; onClick: () => void };

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      // A STABLE HOOK for "this view rendered, and it is legitimately empty".
      // Tests otherwise cannot tell an empty state from a page that failed to
      // render: both are short. The responsive sweep's body-text floor failed
      // /en/saved at all four widths for exactly that reason — 287 characters,
      // which is a correct empty state, not a broken page. One testid on the
      // shared component covers every empty view in the app.
      data-testid="empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center",
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-foreground">{title}</p>
        {description && (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action &&
        ("href" in action ? (
          <Button asChild variant="outline" size="sm">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        ))}
    </div>
  );
}
