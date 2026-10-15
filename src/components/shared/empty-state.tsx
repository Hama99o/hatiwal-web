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
        "flex flex-col items-center justify-center gap-4 rounded-2xl bg-surface px-6 py-14 text-center",
        className,
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary-ink ring-8 ring-primary-soft/50">
        <Icon className="size-6" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-semibold text-foreground sm:text-lg">{title}</p>
        {description && (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action &&
        ("href" in action ? (
          <Button asChild>
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button onClick={action.onClick}>
            {action.label}
          </Button>
        ))}
    </div>
  );
}
