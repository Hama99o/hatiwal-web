"use client";

import { useLocale, useTranslations } from "next-intl";
import { Minus, Plus } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  AMENITY_ICONS,
  STAY_AMENITIES,
  STAY_LIMITS,
  type PriceUnit,
  type StayAmenity,
  type StayDetails,
} from "@/lib/stays";

const CHIP =
  "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors pointer-coarse:h-11";
const chip = (on: boolean) =>
  cn(CHIP, on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent");

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  testId,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  testId: string;
}) {
  const t = useTranslations("listing.stays.form");
  const locale = useLocale();
  const btn =
    "inline-flex size-9 items-center justify-center rounded-full border bg-card transition-colors hover:bg-accent disabled:opacity-40 pointer-coarse:size-11";
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-3" role="group" aria-label={label} data-testid={testId}>
        <button type="button" className={btn} disabled={value <= min} onClick={() => onChange(value - 1)} aria-label={`${t("decrease")} — ${label}`}>
          <Minus className="size-4" aria-hidden />
        </button>
        <span className="min-w-6 text-center text-base font-bold tabular-nums" aria-live="polite" data-testid={`${testId}-value`}>
          {formatNumber(value, locale)}
        </span>
        <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(value + 1)} aria-label={`${t("increase")} — ${label}`}>
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

/**
 * A room's own fields on the sell form (api STAYS_DESIGN §2.2–2.3), shown
 * INSTEAD of the item condition when the category is a stay — the web twin of
 * mobile StayFormFields: price per night / month, guests and beds as − n +
 * steppers (Airbnb host form), private / shared bathroom, amenities as chips,
 * check-in / check-out times. All optional.
 */
export function StayFormFields({
  priceUnit,
  onPriceUnitChange,
  details,
  onDetailsChange,
}: {
  priceUnit: PriceUnit;
  onPriceUnitChange: (unit: PriceUnit) => void;
  details: StayDetails;
  onDetailsChange: (details: StayDetails) => void;
}) {
  const t = useTranslations("listing.stays");
  const set = (patch: Partial<StayDetails>) => onDetailsChange({ ...details, ...patch });
  const amenities = details.amenities ?? [];
  const toggle = (a: StayAmenity) =>
    set({ amenities: amenities.includes(a) ? amenities.filter((x) => x !== a) : [...amenities, a] });

  return (
    <fieldset className="space-y-5 rounded-2xl border bg-card p-4" data-testid="stay-form-fields">
      <legend className="px-1 text-base font-semibold">{t("form.title")}</legend>

      <div className="space-y-2">
        <span className="text-sm font-medium">{t("form.priceUnit")}</span>
        <div className="flex gap-2" role="radiogroup" aria-label={t("form.priceUnit")}>
          {(["night", "month"] as PriceUnit[]).map((unit) => (
            <button
              key={unit}
              type="button"
              role="radio"
              aria-checked={priceUnit === unit}
              className={chip(priceUnit === unit)}
              onClick={() => onPriceUnitChange(unit)}
              data-testid={`stay-price-unit-${unit}`}
            >
              {t(`form.${unit}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-8">
        <Stepper
          label={t("form.guests")}
          value={details.guests ?? 2}
          min={STAY_LIMITS.guests.min}
          max={STAY_LIMITS.guests.max}
          onChange={(guests) => set({ guests })}
          testId="stay-guests"
        />
        <Stepper
          label={t("form.beds")}
          value={details.beds ?? 1}
          min={STAY_LIMITS.beds.min}
          max={STAY_LIMITS.beds.max}
          onChange={(beds) => set({ beds })}
          testId="stay-beds"
        />
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium">{t("form.bathroom")}</span>
        <div className="flex gap-2">
          {(["private", "shared"] as const).map((b) => (
            <button
              key={b}
              type="button"
              aria-pressed={details.bathroom === b}
              className={chip(details.bathroom === b)}
              onClick={() => set({ bathroom: details.bathroom === b ? undefined : b })}
              data-testid={`stay-bathroom-${b}`}
            >
              {t(`form.${b}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium">{t("form.amenities")}</span>
        <div className="flex flex-wrap gap-2">
          {STAY_AMENITIES.map((a) => {
            const Icon = AMENITY_ICONS[a];
            const on = amenities.includes(a);
            return (
              <button
                key={a}
                type="button"
                aria-pressed={on}
                className={chip(on)}
                onClick={() => toggle(a)}
                data-testid={`stay-amenity-${a}`}
              >
                <Icon className="size-4" aria-hidden />
                {t(`amenities.${a}`)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {(["checkIn", "checkOut"] as const).map((key) => (
          <label key={key} className="space-y-2">
            <span className="block text-sm font-medium">{t(`form.${key}`)}</span>
            <input
              type="time"
              value={details[key] ?? ""}
              onChange={(e) => set({ [key]: e.target.value || undefined })}
              className="h-11 w-full rounded-lg border bg-background px-3 text-sm"
              data-testid={`stay-${key}`}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
