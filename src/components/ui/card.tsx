import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

/**
 * THE card surface — one radius/border/background recipe for every
 * bordered panel on the site (listing detail's location + seller cards, the
 * owner action panel, …). Extend it with a `className`; never re-declare
 * `rounded-lg border bg-card` inline.
 *
 * `asChild` renders the recipe onto the caller's own element (Radix `Slot`, same
 * as `Button`), so a panel that needs real semantics — a named `<section>`
 * landmark, an `<article>` — keeps them instead of being flattened to a `<div>`.
 *
 * FLAT, no `shadow-sm`: this app's card language is a hairline border on a
 * `bg-card` fill (every hand-rolled surface here, and `ListingCard`, which lifts
 * to `shadow-md` only on hover). Shipping shadcn's default shadow is part of why
 * this primitive sat unused while surfaces re-declared the recipe around it — a
 * call site should never have to opt OUT of chrome the rest of the site lacks.
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
