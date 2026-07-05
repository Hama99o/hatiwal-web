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
 *
 * `iconOnly` renders compact 44px icon squares (browse grid/list view toggle):
 * the label is visually hidden (`sr-only`) but still drives the accessible
 * name, plus a `title` tooltip — never pass an icon-only option without a label.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  fullWidth = false,
  iconOnly = false,
  disabled = false,
  className,
}: {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  fullWidth?: boolean;
  /** Hide labels visually (kept for screen readers) and size buttons 44x44. */
  iconOnly?: boolean;
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
            title={iconOnly ? opt.label : undefined}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60",
              iconOnly ? "size-11" : "min-h-10 px-4",
              fullWidth && "flex-1",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {Icon && <Icon className="size-4" aria-hidden />}
            <span className={cn(iconOnly && "sr-only")}>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
