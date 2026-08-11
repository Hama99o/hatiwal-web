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
         * Solid primary — for COUNTS (unread messages, waiting chats). The tinted
         * `default` only reaches ~3.6:1 against its own fill, which fails AA for
         * the 12px digits these pills carry; a count a seller is meant to act on
         * has to be legible in both themes, so it gets the full-contrast fill.
         */
        count: "border-transparent bg-primary text-primary-foreground",
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
