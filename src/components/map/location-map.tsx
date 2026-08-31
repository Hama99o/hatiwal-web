"use client";

import dynamic from "next/dynamic";
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Maximize2, MapPinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { isInAfghanistan } from "@/lib/geo";
import { LocationSearch } from "./location-search";
import type { MapImplProps } from "./map-impl";

// Leaflet touches `window` at import, so load it client-only (no SSR).
const MapImpl = dynamic(() => import("./map-impl"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
});

/**
 * Leaflet map. Read-only by default; pass `editable` + `onChange` to pick a
 * point (click or drag the pin), `radiusKm` to draw a search radius,
 * `searchable` to float a place-search box over the map, and `expandable` to
 * add a maximize button that opens the SAME map big in a dialog.
 *
 * The basemap only has Afghanistan tiles, so a point OUTSIDE the country would
 * render blank — we show a fallback message instead of a dead grey box.
 */
export function LocationMap({
  className,
  searchable = false,
  expandable = false,
  ...props
}: MapImplProps & {
  className?: string;
  searchable?: boolean;
  expandable?: boolean;
}) {
  const t = useTranslations();
  const [searchText, setSearchText] = useState("");
  const [expanded, setExpanded] = useState(false);
  const titleId = useId();

  const hasPoint = props.lat != null && props.lng != null;
  const outsideAfghanistan =
    hasPoint && !isInAfghanistan(props.lat as number, props.lng as number);
  const showSearch = searchable && props.editable && !!props.onChange;

  return (
    <>
      {/* No `overflow-hidden` on the frame: the map is clipped by its own inner
          layer, which lets the search dropdown spill past the map's bottom edge
          instead of being cut off. */}
      <div className={cn("relative rounded-lg border bg-muted", className)}>
        {outsideAfghanistan ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
            <MapPinOff className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {t("listing.form.mapAfghanistanOnly")}
            </p>
          </div>
        ) : (
          <>
            <div className="absolute inset-0 overflow-hidden rounded-lg">
              <MapImpl {...props} />
            </div>
            {showSearch && (
              <div
                className={cn(
                  "absolute left-2 top-2 z-[500]",
                  expandable ? "right-12" : "right-2",
                )}
              >
                <LocationSearch
                  value={searchText}
                  placeholder={t("listing.form.searchPlacePlaceholder")}
                  onTextChange={setSearchText}
                  onSelect={(place) => {
                    props.onChange?.(place.lat, place.lng);
                    setSearchText(place.label);
                  }}
                />
              </div>
            )}
            {expandable && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                aria-label={t("listing.form.expandMap")}
                title={t("listing.form.expandMap")}
                className="absolute end-2 top-2 z-[500] grid size-8 place-items-center rounded-md border bg-background/90 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-background"
              >
                <Maximize2 className="size-4" />
              </button>
            )}
          </>
        )}
      </div>

      {expandable && (
        <Dialog
          open={expanded}
          onClose={() => setExpanded(false)}
          labelledBy={titleId}
          className="max-w-4xl"
        >
          <h2 id={titleId} className="mb-3 text-lg font-semibold">
            {t("listing.form.pickLocation")}
          </h2>
          {/* Reuse THIS component (not a fork) big + searchable; it shares the
              same lat/lng/onChange, so picking a point applies live to the
              caller and the small map behind the dialog. */}
          <LocationMap searchable className="h-[70vh]" {...props} />

          {/* The dialog used to have no way out but the X. Picking a point does
              apply live, so this confirms nothing technically — but a
              full-screen map with no primary action reads as unfinished, and a
              user reasonably waits for an Apply that never arrives. Mobile has
              had "Confirm location" here all along (LocationRangePicker's
              `location-confirm`), so this is web catching up, reusing the SAME
              i18n key rather than inventing a second label for one idea. */}
          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              onClick={() => setExpanded(false)}
              data-testid="location-confirm"
            >
              {t("browse.confirmLocation")}
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
