"use client";

import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import L from "leaflet";
import "@maplibre/maplibre-gl-leaflet";
import maplibregl from "maplibre-gl";

// The plugin reads `maplibregl` off the global rather than importing it, so a
// bundled build has to put it there explicitly. Without this the layer throws
// "maplibregl is not defined" at construction — and only in the browser, so a
// type-check and a build both pass while every map is blank.
if (typeof window !== "undefined") {
  (window as unknown as { maplibregl: typeof maplibregl }).maplibregl = maplibregl;
}
import { useLocale } from "next-intl";
import { useEffect, useState } from "react";
import {
  AttributionControl,
  Circle,
  MapContainer,
  Marker,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";

/**
 * Our own basemap. `map.hatiwal.com` serves vector tiles and the style JSON from
 * the VPS we already pay for — see ../../hatiwal-map/README.md.
 *
 * This used to be a Leaflet <TileLayer> pointed at `tile.openstreetmap.org`. That
 * worked, but OSM's tile policy is a courtesy service that explicitly discourages
 * apps with real traffic from relying on it, and they block clients that do. So it
 * was never ours to depend on — it just had not been taken away yet, the way
 * CARTO's "free, keyless" endpoint was taken away from the mobile app.
 *
 * The style file is the SAME one the mobile app reads, so web and mobile are
 * identical by construction rather than by two teams agreeing on hex codes.
 */
const MAP_BASE =
  process.env.NEXT_PUBLIC_MAP_URL?.replace(/\/$/, "") || "https://map.hatiwal.com";

/**
 * Watch the `.dark` class the way usePrimaryColor already does, rather than
 * reading next-themes' `resolvedTheme`: the class is what actually paints the
 * page, it is already the convention in this file, and it cannot disagree with
 * the rest of the UI.
 */
function useIsDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const read = () => setDark(document.documentElement.classList.contains("dark"));
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

/**
 * A MapLibre GL vector layer inside the existing Leaflet map.
 *
 * Deliberately NOT a full Leaflet -> MapLibre migration. Everything else in this
 * file — click-to-set, the radius circle, Recenter, the SVG pin — is working,
 * tested code used by browse, the listing form and listing detail. Swapping only
 * the basemap gets us off OSM's servers and onto our own style with none of that
 * risk. Web renders through Leaflet + GL, mobile through MapLibre native; both
 * read the same style, which is what makes them look the same.
 *
 * Attribution is a LICENCE CONDITION, not decoration: these tiles are
 * OpenMapTiles-derived. The style sets it on the source, and Leaflet's own
 * attribution control renders it.
 */
function HatiwalBasemap() {
  const map = useMap();
  const isDark = useIsDark();
  const locale = useLocale();
  const lang = ["en", "ps", "fa"].includes(locale) ? locale : "en";

  useEffect(() => {
    const styleUrl = `${MAP_BASE}/styles/hatiwal-${isDark ? "dark" : "light"}-${lang}.json`;
    // @ts-expect-error - maplibreGL is attached to L by the plugin, which ships no types.
    const layer = L.maplibreGL({ style: styleUrl, attribution: MAP_ATTRIBUTION });
    layer.addTo(map);
    return () => {
      map.removeLayer(layer);
    };
    // Re-created on theme or language change: the style file IS the design and
    // the label language, so both are style swaps rather than runtime tweaks.
  }, [map, isDark, lang]);

  return null;
}

const MAP_ATTRIBUTION =
  '&copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; ' +
  '<a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Inline SVG pin via divIcon — avoids Leaflet's broken default marker-image
// paths under bundlers (no external image requests).
const PIN = L.divIcon({
  className: "",
  html: `<svg width="30" height="30" viewBox="0 0 24 24" fill="#2563eb" stroke="white" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.9-3.1-7-7-7z"/><circle cx="12" cy="9" r="2.5" fill="white"/></svg>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

// Default map center when no point is set yet (Kabul).
const DEFAULT_CENTER: [number, number] = [34.5553, 69.2075];

function ClickToSet({
  onChange,
}: {
  onChange: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * Read the brand `--primary` color token off :root so the radius circle uses
 * the theme color (Leaflet needs a real color string, not a Tailwind class),
 * and re-read it when next-themes flips the `.dark` class so it adapts.
 */
function usePrimaryColor(): string {
  const [color, setColor] = useState("hsl(221 83% 53%)");
  useEffect(() => {
    const read = () => {
      const v = getComputedStyle(document.documentElement)
        .getPropertyValue("--primary")
        .trim();
      if (v) setColor(v);
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);
  return color;
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

export interface MapImplProps {
  lat: number | null;
  lng: number | null;
  editable?: boolean;
  radiusKm?: number;
  zoom?: number;
  onChange?: (lat: number, lng: number) => void;
}

export default function MapImpl({
  lat,
  lng,
  editable = false,
  radiusKm,
  zoom = 12,
  onChange,
}: MapImplProps) {
  const hasPoint = lat != null && lng != null;
  const primary = usePrimaryColor();
  const center: [number, number] = hasPoint
    ? [lat as number, lng as number]
    : DEFAULT_CENTER;

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom={false}
      zoomControl={false}
      attributionControl={false}
      style={{ height: "100%", width: "100%" }}
    >
      {/* Bottom-right keeps the top clear for the floating location search. */}
      <ZoomControl position="bottomright" />
      {/* `prefix={false}` drops the "Leaflet" branding (NOT licence-required);
          the OpenMapTiles/OSM source credit (a licence CONDITION) is set on the
          basemap layer and stays. Bottom-left avoids the bottom-right zoom;
          styled small + muted in globals.css. */}
      <AttributionControl position="bottomleft" prefix={false} />
      <HatiwalBasemap />
      {editable && onChange && <ClickToSet onChange={onChange} />}
      {hasPoint && (
        <>
          <Marker
            position={[lat as number, lng as number]}
            icon={PIN}
            draggable={editable}
            eventHandlers={
              editable && onChange
                ? {
                    dragend(e) {
                      const p = e.target.getLatLng();
                      onChange(p.lat, p.lng);
                    },
                  }
                : undefined
            }
          />
          {radiusKm ? (
            <Circle
              center={[lat as number, lng as number]}
              radius={radiusKm * 1000}
              pathOptions={{
                color: primary,
                fillColor: primary,
                fillOpacity: 0.1,
              }}
            />
          ) : null}
          <Recenter lat={lat as number} lng={lng as number} />
        </>
      )}
    </MapContainer>
  );
}
