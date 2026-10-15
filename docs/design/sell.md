# Sell / create listing (`/[locale]/listings/new`) — design note (web UI/UX QA, 2026-10-15)

## Problem (before)
The form opened with a small 1/3-width "Add Photos" square — the most important input looked like
the least important one.

## References (Mobbin, web)
- **Depop — List an item (empty)** — https://mobbin.com/screens/a957bce9-7510-43b6-ade4-f085a927e99a
  Photos first, as a large dashed grid with "Add a photo" as the obvious first step.
- **Depop — List an item (with photos)** — https://mobbin.com/screens/f9ea6ec5-efee-41e9-bae9-47a24beb0d1c
  Once photos exist, "Add a photo" becomes one more slot after them.

## Decisions
1. **No photo yet:** the add target spans the whole photo row (`col-span-3/4`, 144px tall), tinted
   primary, with a larger icon and label.
2. **With photos:** unchanged — a square slot after the thumbnails.
Same strings, same input; create and edit share the component.
