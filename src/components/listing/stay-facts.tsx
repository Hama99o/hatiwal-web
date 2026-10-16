import { useLocale, useTranslations } from "next-intl";
import { Bath, BedDouble, Clock, Users } from "lucide-react";
import { localizeDigits } from "@/lib/format";
import { Separator } from "@/components/ui/separator";
import { AMENITY_ICONS, isStayAmenity, type StayDetails } from "@/lib/stays";

/**
 * A stay's facts on the listing page (api STAYS_DESIGN §2.3), mirroring mobile
 * StayFacts: one facts line — guests · beds · bathroom (Airbnb "1 queen bed ·
 * Shared bathroom") — then "What this place offers" as icon + word, then
 * check-in / check-out. Renders nothing for a room with no facts (posted from
 * the 1.1.6 app), so the page never shows an empty section. No hooks beyond
 * translations: renders in the server tree.
 */
export function StayFacts({ details }: { details: StayDetails | null | undefined }) {
  const t = useTranslations("listing.stays");
  const locale = useLocale();
  if (!details) return null;
  const amenities = (details.amenities ?? []).filter(isStayAmenity);
  const facts = [
    details.guests != null && { key: "guests", Icon: Users, label: t("guests", { count: details.guests }) },
    details.beds != null && { key: "beds", Icon: BedDouble, label: t("beds", { count: details.beds }) },
    details.bathroom && {
      key: "bathroom",
      Icon: Bath,
      label: t(details.bathroom === "private" ? "bathroomPrivate" : "bathroomShared"),
    },
  ].filter(Boolean) as { key: string; Icon: typeof Users; label: string }[];
  const times = [
    details.checkIn ? t("checkIn", { time: localizeDigits(details.checkIn, locale) }) : null,
    details.checkOut ? t("checkOut", { time: localizeDigits(details.checkOut, locale) }) : null,
  ].filter(Boolean) as string[];
  if (!facts.length && !amenities.length && !times.length) return null;

  return (
    <section data-testid="stay-facts" className="space-y-4">
      <h2 className="text-lg font-semibold">{t("detailsTitle")}</h2>
      <Separator />
      {facts.length > 0 && (
        <ul data-testid="stay-facts-line" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {facts.map(({ key, Icon, label }) => (
            <li key={key} className="flex items-center gap-2">
              <Icon className="size-4 shrink-0" aria-hidden />
              {label}
            </li>
          ))}
        </ul>
      )}
      {amenities.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">{t("amenitiesTitle")}</h3>
          <ul data-testid="stay-amenities" className="grid gap-2 text-sm sm:grid-cols-2">
            {amenities.map((a) => {
              const Icon = AMENITY_ICONS[a];
              return (
                <li key={a} className="flex items-center gap-2.5">
                  <Icon className="size-4.5 shrink-0" aria-hidden />
                  {t(`amenities.${a}`)}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {times.length > 0 && (
        <ul data-testid="stay-times" className="space-y-1 text-sm text-muted-foreground">
          {times.map((line) => (
            <li key={line} className="flex items-center gap-2">
              <Clock className="size-3.5 shrink-0" aria-hidden />
              <bdi>{line}</bdi>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
