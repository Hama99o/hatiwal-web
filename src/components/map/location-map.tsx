"use client";

import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import type { MapImplProps } from "./map-impl";

// Leaflet touches `window` at import, so load it client-only (no SSR).
const MapImpl = dynamic(() => import("./map-impl"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
});

/**
 * Leaflet map. Read-only by default; pass `editable` + `onChange` to pick a
 * point (click or drag the pin), and `radiusKm` to draw a search radius.
 */
export function LocationMap({
  className,
  ...props
}: MapImplProps & { className?: string }) {
  return (
    <div
      className={cn(
        "relative z-0 overflow-hidden rounded-lg border bg-muted",
        className,
      )}
    >
      <MapImpl {...props} />
    </div>
  );
}
