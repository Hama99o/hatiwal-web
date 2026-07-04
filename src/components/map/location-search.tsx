"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";

// Place search backed by OpenStreetMap Nominatim — the same geocoder the
// mobile app's LocationRangePicker uses, so both clients behave identically.
// Free-typed text is still a valid location label (progressive enhancement);
// picking a suggestion additionally sets exact coordinates.

export interface PlaceResult {
  label: string;
  lat: number;
  lng: number;
}

interface Suggestion {
  display_name: string;
  lat: string;
  lon: string;
}

// Compact "Jalalabad, Nangarhar" style label from Nominatim's long display_name.
export function shortLabel(displayName: string): string {
  return displayName.split(",").slice(0, 2).map((s) => s.trim()).join(", ");
}

// Reverse geocode a point → short label (null on any failure; callers keep
// the previous label rather than blocking the flow on network hiccups).
export async function reverseGeocode(
  lat: number,
  lng: number,
  locale: string,
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=12&accept-language=${locale}`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.display_name ? shortLabel(data.display_name) : null;
  } catch {
    return null;
  }
}

export function LocationSearch({
  id,
  value,
  placeholder,
  onTextChange,
  onSelect,
}: {
  id?: string;
  value: string;
  placeholder?: string;
  /** Fires on every keystroke — free text is a valid location label. */
  onTextChange: (text: string) => void;
  /** Fires when the user picks a suggested place (label + exact coords). */
  onSelect: (place: PlaceResult) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close the dropdown on outside click.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function search(q: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    if (q.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=${locale}&q=${encodeURIComponent(q)}`,
          { signal: ctrl.signal },
        );
        const data: Suggestion[] = res.ok ? await res.json() : [];
        setSuggestions(data);
        setOpen(data.length > 0);
      } catch {
        // Network hiccup / abort — typed text remains a valid label.
        setSuggestions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 400);
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <Input
          id={id}
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(e) => {
            onTextChange(e.target.value);
            search(e.target.value);
          }}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        />
        {loading && (
          <Loader2 className="absolute end-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && (
        <ul
          role="listbox"
          className="absolute z-[1000] mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          {suggestions.map((s, i) => (
            <li key={`${s.lat}-${s.lon}-${i}`}>
              <button
                type="button"
                role="option"
                aria-selected="false"
                className="flex w-full items-start gap-2 px-3 py-2 text-start text-sm hover:bg-accent focus:bg-accent focus:outline-none"
                onClick={() => {
                  onSelect({
                    label: shortLabel(s.display_name),
                    lat: parseFloat(s.lat),
                    lng: parseFloat(s.lon),
                  });
                  setOpen(false);
                  setSuggestions([]);
                }}
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="line-clamp-2">{s.display_name}</span>
              </button>
            </li>
          ))}
          <li className="border-t px-3 py-1.5 text-[10px] text-muted-foreground">
            {t("listing.form.searchAttribution")}
          </li>
        </ul>
      )}
    </div>
  );
}
