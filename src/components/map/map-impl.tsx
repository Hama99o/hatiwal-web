"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useState } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";

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
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
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
