import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

/**
 * The card surface: one radius/border/background recipe, meant to be THE one for
 * every bordered panel on the site. Extend it with a `className`; never
 * re-declare `rounded-lg border bg-card` inline in new code.
 *
 * `asChild` renders the recipe onto the caller's own element (Radix `Slot`, same
 * as `Button`), so a panel that needs real semantics — a named `<section>`
 * landmark, an `<article>` — keeps them instead of being flattened to a `<div>`.
 *
 * WHERE IT ACTUALLY STANDS (do not read the paragraph above as an invariant —
 * it is the destination, not the state): only the listing detail page and
 * `owner-listing-bar.tsx` render through this primitive today. ~20 files still
 * hand-roll `border bg-card` — the profile stats/about cards, my-reports rows,
 * review-card, pending-reviews-nudge, listing-views-chart, the conversations and
 * blocked-users lists, the delete-account sections, listing-card(+skeleton), the
 * categories tiles. Migrating them is a mechanical pass tracked as R19 in
 * `hatiwal-mobile/docs/REFACTOR_DUPLICATION.md`; until it lands, expect to find
 * the recipe repeated and prefer converting a surface you touch over adding
 * another copy.
 *
 * FLAT, no `shadow-sm`: the flat hairline-on-`bg-card` look is what those
 * surfaces (and `ListingCard`, which lifts to `shadow-md` only on hover) already
 * have, so shipping shadcn's default shadow would make every one of those
 * migrations opt OUT of chrome. The two elevated surfaces are elevated on
 * purpose and say so at their own call site — `auth-card.tsx` (`shadow-sm`) and
 * `dialog.tsx` (`shadow-lg`) are lifted things, not page panels, so a shadow
 * there is a `className`, not this primitive's default.
 */
function Card({
  className,
  asChild = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      className={cn(
        "rounded-lg border bg-card text-card-foreground",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col gap-1.5 p-6", className)} {...props} />
  );
}

function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("font-semibold leading-tight tracking-tight", className)}
      {...props}
    />
  );
}

function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)} {...props} />
  );
}

function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center p-6 pt-0", className)} {...props} />
  );
}

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
};
