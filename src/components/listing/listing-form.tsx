"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { History, ImagePlus, Loader2, MapPin, X } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { createListing, updateListing, listingLifecycle } from "@/lib/api/me";
import { categoryName } from "@/lib/api/categories";
import {
  LISTING_CONDITIONS,
  type Category,
  type Listing,
} from "@/lib/types";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RemoteImage } from "@/components/shared/remote-image";
import { LocationMap } from "@/components/map/location-map";
import { LocationSearch, reverseGeocode } from "@/components/map/location-search";
import { cn } from "@/lib/utils";

const CURRENCIES = ["AFN", "USD", "EUR"] as const;
const MAX_PHOTOS = 8;
// Autosaved NEW-listing draft (mirrors mobile ListingForm's AsyncStorage draft).
// Text fields + selected category + location label only — never photos.
const DRAFT_KEY = "hatiwal.listing.newDraft";

interface DraftSnapshot {
  values: {
    title?: string;
    price?: string;
    currency?: string;
    categoryId?: string;
    condition?: string;
    description?: string;
    location?: string;
    address?: string;
    negotiable?: boolean;
  };
  lat: number | null;
  lng: number | null;
  savedAt: number;
}
const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface NewPhoto {
  file: File;
  url: string;
}

export function ListingForm({
  categories,
  listing,
}: {
  categories: Category[];
  listing?: Listing;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const qc = useQueryClient();
  const isEdit = Boolean(listing);

  const [existing, setExisting] = useState(listing?.imageAttachments ?? []);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [newPhotos, setNewPhotos] = useState<NewPhoto[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [lat, setLat] = useState<number | null>(listing?.latitude ?? null);
  const [lng, setLng] = useState<number | null>(listing?.longitude ?? null);
  const [restorableDraft, setRestorableDraft] = useState<DraftSnapshot | null>(
    null,
  );

  // Keep the location LABEL and the pin in sync (mirrors mobile's picker
  // contract: choosing a place sets label + coords together). Moving the pin
  // reverse-geocodes so the text can never contradict the map — the old
  // disconnected input/map let a listing say "Jalalabad" while the pin saved
  // another country's coordinates.
  async function setPoint(la: number, ln: number) {
    setLat(la);
    setLng(ln);
    const label = await reverseGeocode(la, ln, locale);
    if (label) setValue("location", label, { shouldValidate: true });
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      void setPoint(pos.coords.latitude, pos.coords.longitude);
    });
  }

  // Revoke object URLs on unmount to avoid leaks.
  useEffect(() => {
    return () => newPhotos.forEach((p) => URL.revokeObjectURL(p.url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Form values are strings (inputs/selects); numerics are converted on submit.
  const schema = z.object({
    title: z.string().min(1, t("listing.form.titleRequired")).max(150),
    price: z
      .string()
      .refine((v) => Number(v) > 0, t("listing.form.priceRequired")),
    currency: z.enum(CURRENCIES),
    categoryId: z.string().min(1, t("listing.form.categoryRequired")),
    condition: z.string().optional(),
    negotiable: z.boolean(),
    description: z.string().max(2000).optional().or(z.literal("")),
    location: z.string().min(1, t("listing.form.locationRequired")),
    address: z.string().optional().or(z.literal("")),
  });
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: listing?.title ?? "",
      price: listing?.price != null ? String(listing.price) : "",
      currency: (listing?.currency as (typeof CURRENCIES)[number]) ?? "AFN",
      categoryId: listing?.categoryId != null ? String(listing.categoryId) : "",
      condition: listing?.condition ?? "",
      negotiable: listing?.negotiable ?? true,
      description: listing?.description ?? "",
      location: listing?.location ?? "",
      address: listing?.address ?? "",
    },
  });

  const condition = watch("condition");
  const negotiable = watch("negotiable");
  const totalPhotos = existing.length + newPhotos.length;

  // ── Draft autosave (new listings only — mirrors mobile ListingForm) ────────
  // Offer to restore a previously autosaved draft on first open.
  useEffect(() => {
    if (isEdit) return;
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const snap = JSON.parse(raw) as DraftSnapshot;
      const v = snap?.values ?? {};
      if (v.title || v.description || v.price || v.categoryId) {
        setRestorableDraft(snap);
      }
    } catch {
      /* corrupt draft — ignore */
    }
  }, [isEdit]);

  // Persist the form (debounced 800ms) as the user types. Photos are never
  // persisted — the seller re-adds them after a restore.
  useEffect(() => {
    if (isEdit) return;
    let handle: ReturnType<typeof setTimeout> | null = null;
    const sub = watch((values) => {
      if (handle) clearTimeout(handle);
      handle = setTimeout(() => {
        if (
          !values.title &&
          !values.description &&
          !values.price &&
          !values.categoryId
        ) {
          return;
        }
        const snap: DraftSnapshot = { values, lat, lng, savedAt: Date.now() };
        try {
          window.localStorage.setItem(DRAFT_KEY, JSON.stringify(snap));
        } catch {
          /* storage unavailable/full — autosave is best-effort */
        }
      }, 800);
    });
    return () => {
      sub.unsubscribe();
      if (handle) clearTimeout(handle);
    };
  }, [isEdit, watch, lat, lng]);

  const clearDraft = useCallback(() => {
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* storage unavailable — nothing to clear */
    }
  }, []);

  function restoreDraft() {
    if (!restorableDraft) return;
    const v = restorableDraft.values;
    reset({
      title: v.title ?? "",
      price: v.price ?? "",
      currency: CURRENCIES.includes(v.currency as (typeof CURRENCIES)[number])
        ? (v.currency as (typeof CURRENCIES)[number])
        : "AFN",
      categoryId: v.categoryId ?? "",
      condition: v.condition ?? "",
      negotiable: v.negotiable ?? true,
      description: v.description ?? "",
      location: v.location ?? "",
      address: v.address ?? "",
    });
    setLat(restorableDraft.lat ?? null);
    setLng(restorableDraft.lng ?? null);
    setRestorableDraft(null);
  }

  function discardDraft() {
    clearDraft();
    setRestorableDraft(null);
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const room = MAX_PHOTOS - totalPhotos;
    const added = files.slice(0, Math.max(0, room)).map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
    setNewPhotos((prev) => [...prev, ...added]);
    e.target.value = "";
  }

  function removeNew(url: string) {
    setNewPhotos((prev) => {
      const target = prev.find((p) => p.url === url);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((p) => p.url !== url);
    });
  }

  function removeExisting(id: string) {
    setExisting((prev) => prev.filter((img) => img.id !== id));
    setRemovedIds((prev) => [...prev, id]);
  }

  async function save(values: Values, publish: boolean) {
    setSubmitting(true);
    try {
      const input = {
        title: values.title,
        description: values.description || undefined,
        price: Number(values.price),
        currency: values.currency,
        condition: values.condition || undefined,
        negotiable: values.negotiable,
        categoryId: Number(values.categoryId),
        location: values.location || undefined,
        address: values.address || undefined,
        latitude: lat ?? undefined,
        longitude: lng ?? undefined,
      };
      const files = newPhotos.map((p) => p.file);

      if (isEdit && listing) {
        await updateListing(listing.id, input, files, removedIds);
        // Drop the cached pre-edit copies so the manage/list views show the
        // saved values immediately (the global 60s staleTime would otherwise
        // serve the stale listing and make the edit look like it failed).
        qc.invalidateQueries({ queryKey: ["my-listing", listing.id] });
        qc.invalidateQueries({ queryKey: ["my-listings"] });
        toast.success(t("listing.form.saved"));
        router.push(`/my-listings/${listing.id}`);
      } else {
        const created = await createListing(input, files);
        // The listing was saved on the server — drop the autosaved draft.
        clearDraft();
        if (publish) {
          await listingLifecycle(created.id, "publish");
          toast.success(t("listing.form.published"));
        } else {
          toast.success(t("listing.form.savedDraft"));
        }
        // Make the new listing appear in My Listings right away.
        qc.invalidateQueries({ queryKey: ["my-listings"] });
        router.push(`/my-listings/${created.id}`);
      }
    } catch {
      toast.error(
        publish ? t("listing.form.publishError") : t("listing.form.saveError"),
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">
        {isEdit ? t("listing.edit") : t("listing.create")}
      </h1>

      {restorableDraft && (
        <div
          role="status"
          className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4"
        >
          <History className="size-5 shrink-0 text-primary" aria-hidden />
          <p className="min-w-[10rem] flex-1 text-sm">
            {t("listing.form.draftFound")}
          </p>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={restoreDraft}>
              {t("listing.form.draftRestore")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={discardDraft}
            >
              {t("listing.form.draftDiscard")}
            </Button>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit((v) => save(v, false))}
        className="space-y-6"
        noValidate
      >
        {/* Photos */}
        <div className="space-y-2">
          <span className="text-sm font-medium">{t("listing.form.photos")}</span>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {existing.map((img) => (
              <PhotoTile
                key={img.id}
                src={img.url}
                onRemove={() => removeExisting(img.id)}
                label={t("listing.form.removePhoto")}
              />
            ))}
            {newPhotos.map((p) => (
              <PhotoTile
                key={p.url}
                src={p.url}
                onRemove={() => removeNew(p.url)}
                label={t("listing.form.removePhoto")}
              />
            ))}
            {totalPhotos < MAX_PHOTOS && (
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
                <ImagePlus className="size-6" />
                <span className="text-xs">{t("listing.form.addPhotos")}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={onPickFiles}
                />
              </label>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("listing.form.photosHint")}
          </p>
        </div>

        <Field
          label={t("listing.title")}
          htmlFor="title"
          error={errors.title?.message}
        >
          <Input
            id="title"
            placeholder={t("listing.titlePlaceholder")}
            {...register("title")}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label={t("common.price")}
            htmlFor="price"
            error={errors.price?.message}
          >
            <Input
              id="price"
              inputMode="decimal"
              placeholder={t("listing.pricePlaceholder")}
              {...register("price")}
            />
          </Field>
          <Field label={t("listing.form.selectCurrency")} htmlFor="currency">
            <select id="currency" className={SELECT_CLASS} {...register("currency")}>
              <option value="AFN">{t("listing.form.currencyAFN")}</option>
              <option value="USD">{t("listing.form.currencyUSD")}</option>
              <option value="EUR">{t("listing.form.currencyEUR")}</option>
            </select>
          </Field>
        </div>

        <Field
          label={t("common.category")}
          htmlFor="categoryId"
          error={errors.categoryId?.message}
        >
          <select id="categoryId" className={SELECT_CLASS} {...register("categoryId")}>
            <option value="">
              {t("listing.form.selectCategoryPlaceholder")}
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {categoryName(c, locale)}
              </option>
            ))}
          </select>
        </Field>

        <div className="space-y-2">
          <span className="text-sm font-medium">
            {t("listing.condition.label")}
          </span>
          <div className="flex flex-wrap gap-2">
            {LISTING_CONDITIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setValue("condition", condition === c ? "" : c)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm transition-colors",
                  condition === c
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card hover:bg-accent",
                )}
              >
                {t(`listing.condition.${c}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Firm / negotiable price — mirrors mobile's single toggle. Off = firm
            price (gates offers in chat); the backend defaults to negotiable. */}
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border bg-card p-4">
          <span className="text-sm font-medium">
            {t("listing.form.negotiableLabel")}
          </span>
          <input
            type="checkbox"
            className="size-5 shrink-0 accent-primary"
            checked={negotiable}
            onChange={(e) => setValue("negotiable", e.target.checked)}
          />
        </label>

        <Field
          label={t("common.description")}
          htmlFor="description"
          error={errors.description?.message}
        >
          <textarea
            id="description"
            rows={4}
            placeholder={t("listing.descriptionPlaceholder")}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            {...register("description")}
          />
        </Field>

        {/* ONE location control: search a place (Nominatim, same geocoder as
            mobile) OR tap/drag the pin — both keep the label and coordinates
            in sync, so the text can never contradict the map. */}
        <Field
          label={t("common.location")}
          htmlFor="location"
          error={errors.location?.message}
        >
          <LocationSearch
            id="location"
            value={watch("location")}
            placeholder={t("listing.form.searchPlacePlaceholder")}
            onTextChange={(text) =>
              setValue("location", text, { shouldValidate: true })
            }
            onSelect={(place) => {
              setValue("location", place.label, { shouldValidate: true });
              setLat(place.lat);
              setLng(place.lng);
            }}
          />
          <div className="space-y-2 pt-2">
            <LocationMap
              editable
              lat={lat}
              lng={lng}
              onChange={(la, ln) => void setPoint(la, ln)}
              className="h-64"
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {lat != null && lng != null ? (
                  <span className="text-success">{t("listing.form.locationSet")}</span>
                ) : (
                  t("listing.form.tapToSetLocation")
                )}
              </p>
              <Button type="button" variant="ghost" size="sm" onClick={useMyLocation}>
                <MapPin className="size-4" />
                {t("listing.form.useMyLocation")}
              </Button>
            </div>
          </div>
        </Field>

        <Field
          label={t("listing.form.addressLabel")}
          htmlFor="address"
          error={errors.address?.message}
        >
          <Input
            id="address"
            placeholder={t("listing.form.addressPlaceholder")}
            {...register("address")}
          />
          <span className="text-xs text-muted-foreground">
            {t("listing.form.addressHint")}
          </span>
        </Field>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 pt-2">
          {isEdit ? (
            <>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="size-4 animate-spin" />}
                {t("common.save")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/my-listings/${listing!.id}`)}
              >
                {t("common.cancel")}
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                disabled={submitting}
                onClick={handleSubmit((v) => save(v, true))}
              >
                {submitting && <Loader2 className="size-4 animate-spin" />}
                {t("listing.publish")}
              </Button>
              <Button type="submit" variant="outline" disabled={submitting}>
                {t("listing.form.saveDraft")}
              </Button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}

function PhotoTile({
  src,
  onRemove,
  label,
}: {
  src: string;
  onRemove: () => void;
  label: string;
}) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
      <RemoteImage src={src} alt="" fill sizes="120px" className="object-cover" />
      <button
        type="button"
        onClick={onRemove}
        aria-label={label}
        className="absolute end-1 top-1 flex size-8 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
