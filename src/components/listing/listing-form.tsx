"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useHydrated } from "@/lib/use-hydrated";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Boxes, History, ImagePlus, Loader2, MapPin } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { createListing, updateListing, listingLifecycle, relaunchMyListing, deleteListingVideo } from "@/lib/api/me";
import { VideoField, type VideoValue } from "@/components/listing/video-field";
import { discardListingVideoUpload, startListingVideoUpload } from "@/lib/listing-video-upload";
import {
  API_ERROR_CODES,
  apiErrorCode,
  apiErrorMessage,
  describeApiError,
} from "@/lib/api/error-codes";
import { heldUnitsOf, soldUnitsOf } from "@/lib/stock";
import { categoryName } from "@/lib/api/categories";
import { StayFormFields } from "@/components/listing/stay-form-fields";
import { cleanStayDetails, isStayCategoryId, type PriceUnit, type StayDetails } from "@/lib/stays";
import {
  LISTING_CONDITIONS,
  type Category,
  type Listing,
} from "@/lib/types";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PhotoTile } from "@/components/shared/photo-tile";
import { LocationMap } from "@/components/map/location-map";
import { LocationSearch, reverseGeocode } from "@/components/map/location-search";
import { cn } from "@/lib/utils";
import { nativeSelectClass } from "@/components/ui/native-select";

// AFN + PKR first — Hatiwal serves Afghanistan AND Pakistan, so a seller in
// either country finds their own currency at the top. Must stay in step with
// Listing::CURRENCIES in the API and the mobile ListingForm schema; the API is
// the authority and will reject anything not in its list.
const CURRENCIES = ["AFN", "PKR", "USD", "EUR"] as const;
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
    /** A form string, like `price` — converted to a number only on submit. */
    quantity?: string;
  };
  lat: number | null;
  lng: number | null;
  savedAt: number;
}
const SELECT_CLASS = nativeSelectClass({ variant: "field" });

interface NewPhoto {
  file: File;
  url: string;
}

export function ListingForm({
  categories,
  listing,
  relaunch = false,
}: {
  categories: Category[];
  listing?: Listing;
  /**
   * "Edit & relaunch" (owner, 2026-10-12; docs/OWNER_ITEMS_2026-10-12.md item 1):
   * saving the edit also relaunches the listing — +90 days, and back to the top
   * of the feed at most once a week (the API decides and says which).
   */
  relaunch?: boolean;
}) {
  const t = useTranslations();
  const hydrated = useHydrated();
  const locale = useLocale();
  const router = useRouter();
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const isEdit = Boolean(listing);

  const [existing, setExisting] = useState(listing?.imageAttachments ?? []);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [newPhotos, setNewPhotos] = useState<NewPhoto[]>([]);
  // VID: the optional video — the saved one, a newly picked clip, or none.
  const [video, setVideo] = useState<VideoValue | null>(
    listing?.hasVideo
      ? { kind: "remote", posterUrl: listing.videoPosterUrl ?? listing.cardImageUrl ?? null, durationS: listing.videoDurationS ?? null }
      : null,
  );
  // After the listing is saved: hand a new clip to the background uploader
  // (publishing never waits for it), or delete the video the seller removed.
  const syncVideo = (savedId: number) => {
    if (video?.kind === "local") {
      startListingVideoUpload(qc, savedId, video.file, video.window);
    } else if (!video && listing?.hasVideo) {
      discardListingVideoUpload(savedId);
      deleteListingVideo(savedId)
        .then(() => {
          qc.invalidateQueries({ queryKey: ["my-listing", String(savedId)] });
          toast.success(t("listing.video.removed"));
        })
        .catch(() => toast.error(t("listing.video.removeFailed")));
    }
  };
  const [submitting, setSubmitting] = useState(false);
  // Synchronous twin of `submitting`: react-hook-form validates asynchronously
  // before calling save(), so a double click reaches save() twice while the
  // buttons still look enabled — two listings (error sweep, 1.1.6).
  const submittingRef = useRef(false);
  /**
   * The one save failure a seller has to ACT on, in their own language: they
   * lowered the quantity below what is already sold or held.
   *
   * Held HERE, beside the quantity field, rather than in a toast — the fix is to
   * change that number, so the sentence belongs under it. This used to be
   * swallowed by a blanket `catch` into "Couldn't save your listing", which is
   * the exact "the user did not see this error, it said server error" report
   * that put machine codes on the API in the first place.
   */
  const [quantityServerError, setQuantityServerError] = useState<string | null>(
    null,
  );
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
    // "en", NOT the UI locale: this label is SAVED on the listing and then
    // read by buyers in all three locales. Asking in the creator's language
    // is why a real production listing shows
    // "لسمه ناحیه، کابل، کابل شاروالي." on the ENGLISH page, and another shows
    // its city as "پاريس" — unreadable to two thirds of the audience. The
    // SEARCH box keeps the user's locale (that is their own query, read once);
    // only the persisted address is canonical. Mirrors mobile's
    // `reverseGeocode(..., { canonical: true })`.
    const label = await reverseGeocode(la, ln, "en");
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
    // A string like every other field here (the form's own convention —
    // numerics are converted on submit), and never required: an empty value is
    // a single-item listing, which is what the toggle being off means.
    quantity: z
      .string()
      .refine(
        (v) => v === "" || (Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 999),
        t("listing.form.quantityInvalid"),
      )
      .optional(),
    description: z.string().max(2000).optional().or(z.literal("")),
    location: z.string().min(1, t("listing.form.locationRequired")),
    address: z.string().optional().or(z.literal("")),
  });
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    setError,
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
      quantity: listing?.quantity != null && listing.quantity > 1 ? String(listing.quantity) : "",
      description: listing?.description ?? "",
      location: listing?.location ?? "",
      address: listing?.address ?? "",
    },
  });

  const condition = watch("condition");
  // Stays (api STAYS_DESIGN): the chosen category's kind swaps the item
  // condition for the room's own fields. Kept beside the form (not in zod):
  // they are optional, typed, and cleaned on the way out.
  const isStay = isStayCategoryId(categories, Number(watch("categoryId")) || null);
  const [priceUnit, setPriceUnit] = useState<PriceUnit>(listing?.priceUnit ?? "night");
  // A room with no facts yet (new, or posted from the 1.1.6 app) starts at what
  // the steppers show — 2 guests, 1 bed — so what is shown is what is saved.
  const [stayDetails, setStayDetails] = useState<StayDetails>(
    listing?.details && Object.keys(listing.details).length ? listing.details : { guests: 2, beds: 1 },
  );
  const negotiable = watch("negotiable");
  // Multi-quantity (docs/SPIKE_LISTING_QUANTITY.md). Seeded from the listing
  // being edited, so a 15-unit listing reopens with its number showing instead
  // of a switch that reads "off" over a value of 15 the seller can neither see
  // nor correct.
  const [hasMultipleUnits, setHasMultipleUnits] = useState(
    listing?.quantity != null && listing.quantity > 1,
  );
  const quantityField = register("quantity");
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
      quantity: v.quantity ?? "",
      description: v.description ?? "",
      location: v.location ?? "",
      address: v.address ?? "",
    });
    setHasMultipleUnits(Number(v.quantity ?? "") > 1);
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
    if (submittingRef.current) return;
    // PUBLISHING requires a real point, not just text.
    //
    // `LocationSearch`'s `onTextChange` sets the location STRING on every
    // keystroke and never touches lat/lng — only picking a suggestion or tapping
    // the map does. So typing "Kandahar" and pressing Publish produced a listing
    // with a location label and NO coordinates, which is exactly the shape of
    // production listing 39: it renders no map at all, and it can never appear
    // in a radius or distance search — the whole point of the map surface.
    //
    // Mobile has always blocked this (`publishReadiness.ts` lists "location"
    // among its publish blockers); web did not, and the divergence leaked
    // pin-less listings into shared data both clients read. Drafts stay exempt,
    // matching mobile and the API's own draft rules.
    if (publish && (lat == null || lng == null)) {
      setError("location", { message: t("listing.form.pinRequired") });
      document
        .getElementById("location")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    // Last attempt's refusal is about last attempt's number.
    setQuantityServerError(null);
    try {
      const input = {
        title: values.title,
        description: values.description || undefined,
        price: Number(values.price),
        currency: values.currency,
        condition: values.condition || undefined,
        negotiable: values.negotiable,
        // Off, or cleared, is a single item — send 1 explicitly so switching a
        // batch listing back to one unit actually persists.
        quantity: hasMultipleUnits && values.quantity ? Number(values.quantity) : 1,
        categoryId: Number(values.categoryId),
        location: values.location || undefined,
        address: values.address || undefined,
        latitude: lat ?? undefined,
        longitude: lng ?? undefined,
        // A room has no condition; it sends its unit and facts instead.
        ...(isStay
          ? { condition: undefined, priceUnit, details: cleanStayDetails(stayDetails) }
          : {}),
      };
      const files = newPhotos.map((p) => p.file);

      if (isEdit && listing) {
        await updateListing(listing.id, input, files, removedIds);
        syncVideo(listing.id);
        const relaunched = relaunch ? await relaunchMyListing(listing.id) : null;
        // Drop the cached pre-edit copies so the manage/list views show the
        // saved values immediately (the global 60s staleTime would otherwise
        // serve the stale listing and make the edit look like it failed).
        // The manage screen keys it by the route param — a STRING id.
        qc.invalidateQueries({ queryKey: ["my-listing", listing.id] });
        qc.invalidateQueries({ queryKey: ["my-listing", String(listing.id)] });
        qc.invalidateQueries({ queryKey: ["my-listings"] });
        if (relaunched) {
          // A relaunch puts it back in the public feed.
          qc.invalidateQueries({ queryKey: ["listings"] });
          toast.success(
            t(relaunched.bumped ? "listing.relaunchedBumped" : "listing.relaunchedRenewed"),
          );
        } else {
          toast.success(t("listing.form.saved"));
        }
        router.push(`/my-listings/${listing.id}`);
      } else {
        const created = await createListing(input, files);
        syncVideo(created.id);
        // The listing was saved on the server — drop the autosaved draft.
        clearDraft();
        if (publish) {
          try {
            await listingLifecycle(created.id, "publish");
          } catch (error) {
            // The listing EXISTS (as a draft) — staying on this form would let
            // the next Publish create it a second time. Go to it, say why the
            // publish did not happen; Publish is one tap from there.
            toast.error(describeApiError(error, t, { fallbackKey: "listing.form.publishError" }));
            qc.invalidateQueries({ queryKey: ["my-listings"] });
            router.push(`/my-listings/${created.id}`);
            return;
          }
          // VER-1 (parity with the app's PublishSuccessSheet): a soft line after
          // a FIRST listing, never a popup, never blocking — not verified yet and
          // at most this one live listing (the cached count may not include it).
          const verifyNudge = !!me && !me.verified && (me.itemsActiveCount ?? 0) <= 1;
          toast.success(
            t("listing.form.published"),
            verifyNudge
              ? {
                  description: t("verify.nudge"),
                  action: { label: t("verify.cta"), onClick: () => router.push("/profile/verify") },
                  duration: 10_000,
                }
              : undefined,
          );
        } else {
          toast.success(t("listing.form.savedDraft"));
        }
        // Make the new listing appear in My Listings right away.
        qc.invalidateQueries({ queryKey: ["my-listings"] });
        router.push(`/my-listings/${created.id}`);
      }
    } catch (error) {
      // Which count the message needs depends on WHICH refusal it is: how many
      // are sold, or how many are held. Both are already on the listing being
      // edited — the 422 carries the code, never the number.
      const code = apiErrorCode(error);
      const count =
        code === API_ERROR_CODES.quantityBelowHeldUnits
          ? heldUnitsOf(listing)
          : soldUnitsOf(listing);
      const explained =
        code === API_ERROR_CODES.quantityBelowSoldUnits ||
        code === API_ERROR_CODES.quantityBelowHeldUnits
          ? apiErrorMessage(error, t, { count })
          : null;
      if (explained) {
        // Inline, under the field the seller has to change. No toast: a toast
        // over a long form does not say WHICH input is wrong, and this one is
        // actionable rather than transient.
        setQuantityServerError(explained);
      } else {
        // Offline / 429 (creating is throttled) / any other coded refusal
        // (listing_removed, shop_unavailable…) in words — and only the quantity
        // refusals above go under the field.
        toast.error(
          describeApiError(error, t, {
            fallbackKey: publish ? "listing.form.publishError" : "listing.form.saveError",
          }),
        );
      }
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-title font-extrabold">
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
        method="post"
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
              /* No photo yet: the add target spans the whole row, tinted — photos are
                 the first thing a buyer sees, so they are the first thing asked for
                 (Depop "List an item"). Once there are photos it is one more slot. */
              <label
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed transition-colors hover:border-primary/50 hover:text-foreground",
                  totalPhotos === 0
                    ? "col-span-3 h-36 border-primary/40 bg-primary/5 text-primary sm:col-span-4"
                    : "aspect-square text-muted-foreground",
                )}
              >
                <ImagePlus className={totalPhotos === 0 ? "size-8" : "size-6"} />
                <span className={totalPhotos === 0 ? "text-sm font-semibold" : "text-xs"}>{t("listing.form.addPhotos")}</span>
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

        {/* VID: the optional video, right under the photos. */}
        <VideoField value={video} onChange={setVideo} listingId={isEdit ? listing?.id : null} />

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
              <option value="PKR">{t("listing.form.currencyPKR")}</option>
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
          {/* GROUPED BY PARENT, not a flat list.

              This used to receive `flattenCategories(...)` and render every row
              identically, so "Ruby" sat as an apparent sibling of "Electronics"
              with nothing to say it belongs under Gemstones. That is ~66
              indistinguishable options today and grows with every subcategory —
              the gemstones work alone added 18.

              Parents stay SELECTABLE, deliberately, which diverges from mobile
              (where tapping a parent drills in and only a leaf can be chosen).
              Making them unselectable here would strand any listing already
              filed under a parent: the select would render blank while
              react-hook-form still held the old id, and the seller could not see
              what their listing was set to. Organising the list is the win;
              changing what is savable is a separate decision with a data
              migration attached. */}
          <select id="categoryId" className={SELECT_CLASS} {...register("categoryId")}>
            <option value="">
              {t("listing.form.selectCategoryPlaceholder")}
            </option>
            {categories.map((parent) =>
              parent.subcategories?.length ? (
                <optgroup key={parent.id} label={categoryName(parent, locale)}>
                  <option value={parent.id}>{categoryName(parent, locale)}</option>
                  {parent.subcategories.map((child) => (
                    <option key={child.id} value={child.id}>
                      {categoryName(child, locale)}
                    </option>
                  ))}
                </optgroup>
              ) : (
                <option key={parent.id} value={parent.id}>
                  {categoryName(parent, locale)}
                </option>
              ),
            )}
          </select>
        </Field>

        {isStay ? (
          <StayFormFields
            priceUnit={priceUnit}
            onPriceUnitChange={setPriceUnit}
            details={stayDetails}
            onDetailsChange={setStayDetails}
          />
        ) : (
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
                  "inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium transition-colors pointer-coarse:h-11",
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
        )}

        {/* Firm / negotiable price — mirrors mobile's single toggle. Off = firm
            price (gates offers in chat); the backend defaults to negotiable. */}
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border bg-card p-4">
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

        {/* Multi-quantity — docs/SPIKE_LISTING_QUANTITY.md §12.1. A second row in
            the SAME price block as Negotiable above, because quantity is
            semantically an annex to price ("does this number mean one item or a
            lot?"). Collapsed to a single toggle when off, so a seller with one
            item sees no new field, no header, and no "1" to confirm. */}
        <div className="space-y-3 rounded-2xl border bg-card p-4">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Boxes className="size-4 text-muted-foreground" />
              {t("listing.form.multipleUnitsLabel")}
            </span>
            <input
              type="checkbox"
              className="size-5 shrink-0 accent-primary"
              checked={hasMultipleUnits}
              onChange={(e) => {
                const on = e.target.checked;
                setHasMultipleUnits(on);
                // Pre-fill "2": flipping this on already means "more than one",
                // so the next keystroke fixes the number instead of starting
                // from an empty/invalid state. Off clears it back to a plain
                // single-item listing.
                setValue("quantity", on ? "2" : "");
              }}
              aria-label={t("listing.form.multipleUnitsLabel")}
            />
          </label>

          {hasMultipleUnits && (
            <Field
              label={t("listing.form.howManyUnits")}
              htmlFor="quantity"
              // The server's refusal takes precedence over the client's format
              // check: if Rails has said "you have already sold 8", that is the
              // thing the seller needs to read, not "enter a number 1-999".
              error={quantityServerError ?? errors.quantity?.message}
            >
              <Input
                id="quantity"
                type="number"
                min={1}
                max={999}
                inputMode="numeric"
                placeholder="2"
                {...quantityField}
                // Retyping the number clears the server's refusal about the OLD
                // one — otherwise "you have already sold 8" sits under a field
                // that now reads 9 and the seller cannot tell they have fixed it.
                onChange={(e) => {
                  quantityField.onChange(e);
                  setQuantityServerError(null);
                }}
                // A cleared field reads as 1, matching mobile's own coercion:
                // without it the toggle says "more than one" while the form
                // submits a single-unit listing, and the seller only finds out
                // when the stock pill is missing afterwards. On blur, not on
                // every keystroke, so backspacing to retype is not fought.
                //
                // Chains RHF's own onBlur rather than replacing it — spreading
                // `register()` and then declaring onBlur AFTER it silently drops
                // the handler RHF uses for touched/validate-on-blur state.
                onBlur={(e) => {
                  quantityField.onBlur(e);
                  if (e.target.value.trim() === "") setValue("quantity", "1");
                }}
              />
            </Field>
          )}
        </div>

        <Field
          label={t("common.description")}
          htmlFor="description"
          error={errors.description?.message}
        >
          <Textarea
            id="description"
            rows={4}
            placeholder={t("listing.descriptionPlaceholder")}
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
              expandable
              lat={lat}
              lng={lng}
              onChange={(la, ln) => void setPoint(la, ln)}
              className="h-72"
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
              <Button type="submit" disabled={!hydrated || submitting}>
                {submitting && <Loader2 className="size-4 animate-spin" />}
                {relaunch ? t("listing.saveRelaunch") : t("common.save")}
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
