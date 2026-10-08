import type { LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

/**
 * The page a RESOURCE route (listing, shop, seller…) renders on a 404: says the
 * thing is no longer available — not a bare "404 / No results" — and offers
 * the way back. One component for every `not-found.tsx` that needs it.
 */
export function ResourceNotFound({
  icon: Icon,
  title,
  backHref,
  backLabel,
  testId,
}: {
  icon: LucideIcon;
  title: string;
  backHref: string;
  backLabel: string;
  testId: string;
}) {
  return (
    <div
      className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center"
      data-testid={testId}
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-7" />
      </div>
      <h1 className="text-xl font-bold">{title}</h1>
      <Button asChild>
        <Link href={backHref}>{backLabel}</Link>
      </Button>
    </div>
  );
}
