import { cva } from "class-variance-authority";

/**
 * The ONE look for a native `<select>` (it was spelled out three times, in the
 * listing form, the profile form and the Bazaar sort). Native on purpose: the
 * phone's own picker is the best one there is.
 *
 *   field — a form field, matching `ui/input.tsx` (44px, rounded-xl).
 *   pill  — a toolbar control beside pill buttons (the Bazaar sort): 36px with
 *           a mouse, 44px on a touch screen (web UI/UX QA #22).
 */
export const nativeSelectClass = cva(
  "border border-input bg-background text-sm shadow-xs transition-[border-color,box-shadow] hover:border-foreground/30 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15",
  {
    variants: {
      variant: {
        field: "flex h-11 w-full rounded-xl px-3.5",
        pill: "h-9 rounded-full ps-3 pe-2 font-medium pointer-coarse:h-11",
      },
    },
    defaultVariants: { variant: "field" },
  },
);
