import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/10 text-primary",
        /**
         * Solid — for COUNTS (unread messages, buyers waiting on a listing).
         * Render it through `<CountBadge>` (components/shared/count-badge.tsx)
         * rather than directly, so every count in the app also agrees on digits.
         *
         * `--primary-strong`, not `--primary`: the tinted `default` reaches only
         * ~3.6:1 against its own fill, and a solid `--primary` is 4.9:1 in light
         * but *3.6:1 in dark* — both under the 4.5:1 AA floor that the 12px
         * digits in these pills sit at. The pair goes together: the fill flips
         * away from each theme's background (deep in light, bright in dark) and
         * `--primary-strong-foreground` supplies the matching ink, so the pill
         * clears AA for its digits (6.8:1 light · 5.5:1 dark) AND stays a good
         * 3:1+ louder than the surface under it (6.5:1 · 5.5:1). Both are
         * asserted in e2e/listing-detail.spec.ts, so a palette tweak can't
         * silently re-break — or quietly mute — the one number the owner panel
         * exists to make a seller act on.
         */
        count:
          "border-transparent bg-primary-strong text-primary-strong-foreground",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        muted: "border-transparent bg-muted text-muted-foreground",
        outline: "text-foreground",
        success: "border-transparent bg-success/10 text-success",
        warning: "border-transparent bg-warning/15 text-warning",
        destructive:
          "border-transparent bg-destructive/10 text-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
