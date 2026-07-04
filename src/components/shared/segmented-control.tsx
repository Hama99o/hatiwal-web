"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SegmentedControlOption<T extends string> = {
  value: T;
  label: string;
  icon?: LucideIcon;
  disabled?: boolean;
};

/**
 * Shared pill segmented control (tablist). One implementation for every
 * two/three-way in-page switch — the chat Inbox/Archived toggle, the seller
 * profile Active/Sold tabs, the buyer/seller mode toggle — so the tokens and
 * a11y stay identical. Active state uses `bg-primary` to match the mobile
 * client's segmented control (`colors.primary` / `primaryForeground`).
 *
 * A11y: WAI-ARIA tablist pattern (`role="tablist"` + `role="tab"` +
 * `aria-selected`). Tap targets are >=40px tall (`min-h-10`). RTL-safe — uses
 * logical padding and lays out with flex, no hardcoded left/right.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  fullWidth = false,
  disabled = false,
  className,
}: {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex rounded-full border bg-muted p-1",
        fullWidth && "w-full",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled || opt.disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60",
              fullWidth && "flex-1",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {Icon && <Icon className="size-4" />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
