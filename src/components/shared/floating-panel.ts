/**
 * The one floating-surface recipe for panels that hang off a field.
 *
 * Web has two popovers that are NOT Radix — the recent-searches chips
 * (`search-history-panel.tsx`, whose chips carry their own Remove buttons, so it
 * may not be a menu/listbox, and which must never steal the caret from the
 * field) and the location autocomplete (`map/location-search.tsx`, a listbox
 * over a Leaflet map). Both used to re-declare the surface by hand and had
 * already drifted apart (`rounded-xl` vs `rounded-md`, a redundant
 * `border-border`), so the radius/border/background/shadow now live here and are
 * imported by both.
 *
 * Deliberately surface-ONLY: no positioning, no width, no z-index, no padding.
 * Those genuinely differ per host (the chips are `z-50` inside a sticky sidebar,
 * the location list `z-[1000]` above Leaflet's panes) and belong at the call
 * site. `border` alone is enough — `globals.css` sets `* { border-color:
 * var(--border) }`.
 *
 * Kept in step with `src/components/ui/dropdown-menu.tsx`, the Radix content
 * surface every menu on the site already uses: same tokens, so a hand-placed
 * panel and a Radix menu read as the same object.
 */
export const FLOATING_PANEL_SURFACE =
  "rounded-md border bg-popover text-popover-foreground shadow-md";
