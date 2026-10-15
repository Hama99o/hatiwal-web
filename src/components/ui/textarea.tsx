import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The multi-line counterpart of `<Input>`, sharing its exact class base.
 *
 * It exists because five call sites had hand-copied that base and already
 * drifted: two dropped `placeholder:text-muted-foreground` (so under Tailwind v4
 * preflight the hint rendered at 50% of `foreground` instead of the muted token,
 * loudest in dark mode) and all five dropped the focus-ring offset and the
 * `disabled:` treatment, so their focus ring hugged the border while every other
 * field on the site offsets it. Height is left to `rows`/`className` — that is
 * the only difference from `Input`, which pins `h-10`.
 */
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "flex w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-base shadow-xs sm:text-[0.9375rem] transition-[border-color,box-shadow] placeholder:text-muted-foreground hover:border-foreground/30 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
