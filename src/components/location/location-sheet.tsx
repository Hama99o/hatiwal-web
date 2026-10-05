"use client";

import { useId, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Check, Loader2, LocateFixed, Map as MapIcon } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LocationMap } from "@/components/map/location-map";
import { useAuth } from "@/components/auth/auth-provider";
import { updateProfile } from "@/lib/api/me";
import { AFGHAN_PROVINCES, getProvinceName, nearestProvince } from "@/lib/provinces";
import { isInServiceArea } from "@/lib/service-area";
import { cn } from "@/lib/utils";

type Pending = { province: string; latitude: number | null; longitude: number | null };

/**
 * "Where do you live?" — the Bazaar bar's Change sheet (LOC-1). Web twin of
 * mobile's LocationChangeSheet, same rules and test ids:
 * - Saving sets the OWN address, which from then on beats every guess.
 * - "Use my current location" asks the browser for GPS on THIS click only.
 * - A province alone saves that province and clears the old map point, so the
 *   two can never disagree.
 * - "Choose an area on the map" reveals the shared LocationMap for a precise point.
 * - Nothing outside Afghanistan/Pakistan/Iran is saved; a note says why.
 */
export function LocationSheet({
  open,
  onClose,
  currentProvince,
}: {
  open: boolean;
  onClose: () => void;
  currentProvince: string | null;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const titleId = useId();
  const { setUser } = useAuth();
  const [pending, setPending] = useState<Pending | null>(null);
  const [search, setSearch] = useState("");
  const [locating, setLocating] = useState(false);
  const [outside, setOutside] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const saveM = useMutation({
    mutationFn: (p: Pending) => updateProfile(p),
    onSuccess: (user) => {
      setUser(user);
      toast.success(t("location.saved"));
      close();
    },
  });
  const saving = saveM.isPending;

  const close = () => {
    setPending(null);
    setSearch("");
    setOutside(false);
    setShowMap(false);
    saveM.reset();
    onClose();
  };

  const choosePoint = (latitude: number, longitude: number) => {
    if (!isInServiceArea({ latitude, longitude })) {
      setOutside(true);
      return;
    }
    const p = nearestProvince(latitude, longitude);
    if (!p) return;
    setOutside(false);
    setPending({ province: p.value, latitude, longitude });
  };

  const useCurrent = () => {
    if (!navigator.geolocation) {
      toast.error(t("browse.locationUnsupported"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        choosePoint(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setLocating(false);
        toast.error(
          t(err.code === err.PERMISSION_DENIED ? "browse.locationDenied" : "browse.locationUnavailable"),
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };


  const provinces = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return AFGHAN_PROVINCES;
    return AFGHAN_PROVINCES.filter(
      (p) =>
        p.en.toLowerCase().includes(q) ||
        p.ps.includes(search) ||
        p.fa.includes(search) ||
        (p.ur ?? "").includes(search) ||
        (p.aliases ?? []).some((a) => a.toLowerCase().includes(q)),
    );
  }, [search]);

  const selected = pending?.province ?? currentProvince;

  return (
    <Dialog
      open={open}
      onClose={close}
      labelledBy={titleId}
      dismissible={!saving}
      className="flex max-h-[85vh] max-w-md flex-col gap-3"
    >
      <div data-testid="location-sheet" className="flex min-h-0 flex-col gap-3">
        <h2 id={titleId} className="text-lg font-semibold">
          {t("location.whereDoYouLive")}
        </h2>

        <div className="flex flex-col gap-1">
          <button
            type="button"
            data-testid="location-use-current"
            onClick={useCurrent}
            disabled={locating}
            className="flex items-center gap-2 rounded-md px-2 py-2 text-start text-sm font-semibold text-primary hover:bg-accent disabled:opacity-70"
          >
            {locating ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LocateFixed className="size-4" aria-hidden />}
            {locating ? t("location.locating") : t("location.useCurrent")}
          </button>
          <button
            type="button"
            data-testid="location-pick-on-map"
            onClick={() => setShowMap((v) => !v)}
            aria-expanded={showMap}
            className="flex items-center gap-2 rounded-md px-2 py-2 text-start text-sm text-foreground hover:bg-accent"
          >
            <MapIcon className="size-4 text-primary" aria-hidden />
            {t("location.pickOnMap")}
          </button>
          {showMap && (
            <LocationMap
              editable
              searchable
              lat={pending?.latitude ?? null}
              lng={pending?.longitude ?? null}
              onChange={(la, ln) => choosePoint(la, ln)}
              className="h-56"
            />
          )}
          {outside && (
            <p data-testid="location-outside-note" className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              {t("location.outsideServiceArea")}
            </p>
          )}
        </div>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("location.searchProvinces")}
          aria-label={t("location.searchProvinces")}
          className="h-9"
        />

        <ul className="min-h-0 flex-1 overflow-y-auto rounded-md border [scrollbar-width:thin]" role="listbox" aria-labelledby={titleId}>
          {provinces.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">{t("common.noResults")}</li>
          ) : (
            provinces.map((p) => {
              const isSelected = p.value === selected;
              return (
                <li key={p.value} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    data-testid={`location-province-${p.value}`}
                    onClick={() => {
                      setOutside(false);
                      setPending({ province: p.value, latitude: null, longitude: null });
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 border-b px-3 py-2.5 text-start text-sm last:border-b-0 hover:bg-accent",
                      isSelected && "bg-muted font-semibold",
                    )}
                  >
                    <span>{getProvinceName(p, locale)}</span>
                    {isSelected && <Check className="size-4 text-primary" aria-hidden />}
                  </button>
                </li>
              );
            })
          )}
        </ul>

        {saveM.isError && (
          <p role="alert" className="text-sm text-destructive">
            {t("location.saveError")}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={close} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button type="button" data-testid="location-save" onClick={() => pending && saveM.mutate(pending)} disabled={!pending || saving}>
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {t("location.save")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
