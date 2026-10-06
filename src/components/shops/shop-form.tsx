"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BadgeCheck, Check, ChevronRight, ImagePlus, MapPin, Pencil, Store, X } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { UserIdentity } from "@/components/shared/user-identity";
import { LocationMap } from "@/components/map/location-map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { EMAIL_UNCONFIRMED, markEmailUnconfirmed } from "@/components/account/email-confirm-gate";
import { categoryName, getCategories } from "@/lib/api/categories";
import { createShop, getMyShop, updateShop, type Shop, type ShopInput } from "@/lib/api/shops";
import { presetHours, detectPreset, hoursAreValid, isValidRange, SHOP_DAYS, type HoursPreset, type ShopHours, type ShopDay } from "@/lib/shop-hours";
import { normalizeDigits } from "@/lib/normalize-digits";
import { cn } from "@/lib/utils";
import { ShopOpened } from "./shop-opened";

/**
 * SHOP-1 "Open your shop" / "Edit shop" on the web: the same 8 steps and rules
 * as mobile (hatiwal-mobile src/screens/shops/form), one question per screen,
 * progress bar, and on desktop two columns: the step + a live preview.
 *
 * Progress (text fields only; never a photo) is saved in this browser per
 * account and cleared on success; edit mode starts on the summary and saves
 * nothing locally. testids mirror mobile (shop-form-*).
 */
type Step = "why" | "name" | "category" | "logo" | "location" | "hours" | "contact" | "review";
const STEPS: Step[] = ["why", "name", "category", "logo", "location", "hours", "contact", "review"];

interface Draft {
  step: Step;
  name: string;
  description: string;
  categoryId: number | null;
  latitude: number | null;
  longitude: number | null;
  addressLine: string;
  hoursPreset: HoursPreset | null;
  hours: ShopHours;
  phone: string;
  phonePublic: boolean;
}

const EMPTY: Draft = {
  step: "why",
  name: "",
  description: "",
  categoryId: null,
  latitude: null,
  longitude: null,
  addressLine: "",
  hoursPreset: null,
  hours: {},
  phone: "",
  phonePublic: false,
};

export const SHOP_DRAFT_KEY = "hatiwal.shop-draft";

const nameValid = (n: string) => n.trim().length >= 2 && n.trim().length <= 50;
const stepComplete = (s: Step, d: Draft) =>
  s === "name"
    ? nameValid(d.name) && d.description.trim().length <= 160
    : s === "category"
      ? d.categoryId != null
      : s === "location"
        ? d.latitude != null && d.longitude != null && d.addressLine.trim().length > 0 && d.addressLine.trim().length <= 160
        : s === "hours"
          ? hoursAreValid(d.hours)
          : s === "contact"
            ? d.phone.trim().length <= 30
            : true;

function fromShop(shop: Shop): Draft {
  return {
    ...EMPTY,
    step: "review",
    name: shop.name,
    description: shop.description ?? "",
    categoryId: shop.categoryId,
    latitude: Number(shop.latitude),
    longitude: Number(shop.longitude),
    addressLine: shop.addressLine ?? "",
    hours: shop.hours ?? {},
    hoursPreset: detectPreset(shop.hours ?? {}),
    phone: shop.phone ?? "",
    phonePublic: !!shop.phonePublic,
  };
}

function ImagePick({ label, file, existing, square, onPick, testId }: { label: string; file: File | null; existing?: string | null; square?: boolean; onPick: (f: File | null) => void; testId: string }) {
  const t = useTranslations("shops.form.logo");
  const input = useRef<HTMLInputElement>(null);
  const url = useMemo(() => (file ? URL.createObjectURL(file) : existing ?? null), [file, existing]);
  useEffect(() => () => {
    if (file && url) URL.revokeObjectURL(url);
  }, [file, url]);
  return (
    <div className="space-y-2">
      <span className="text-sm font-semibold">{label}</span>
      <button
        type="button"
        onClick={() => input.current?.click()}
        data-testid={testId}
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-2xl border-2 bg-muted",
          url ? "border-solid" : "border-dashed border-primary",
          square ? "size-28" : "aspect-video w-full",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
        {url ? <img src={url} alt="" className="size-full object-cover" /> : <ImagePlus className="size-7 text-primary" />}
      </button>
      {file && (
        <button type="button" className="text-sm text-destructive" onClick={() => onPick(null)} data-testid={`${testId}-remove`}>
          {t("remove")}
        </button>
      )}
      <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} data-testid={`${testId}-input`} onChange={(e) => { onPick(e.target.files?.[0] ?? null); e.target.value = ""; }} />
    </div>
  );
}

export function ShopForm({ shopId }: { shopId?: number }) {
  const t = useTranslations("shops");
  const locale = useLocale();
  const router = useRouter();
  const qc = useQueryClient();
  const { user, refresh, setUser } = useAuth();
  const editing = shopId != null;

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [logo, setLogo] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [ready, setReady] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errorKey, setErrorKey] = useState<string | null>(null);
  // SHOP-2: the same shop as one of yours (same name within 200 m, or the same address).
  const [duplicateId, setDuplicateId] = useState<number | null>(null);
  const [opened, setOpened] = useState<Shop | null>(null);

  const { data: shop } = useQuery({ queryKey: ["shop", shopId], queryFn: () => getMyShop(shopId as number), enabled: editing });
  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: () => getCategories() });
  const top = (categories ?? []).filter((c) => !c.parentId);

  // Resume (create) or prefill (edit) once.
  useEffect(() => {
    if (ready) return;
    if (editing) {
      if (shop) {
        setDraft(fromShop(shop));
        setReady(true);
      }
      return;
    }
    if (!user) return;
    try {
      const saved = JSON.parse(window.localStorage.getItem(SHOP_DRAFT_KEY) ?? "null") as (Draft & { userId: number }) | null;
      if (saved && saved.userId === user.id) setDraft({ ...EMPTY, ...saved });
      else if (saved) window.localStorage.removeItem(SHOP_DRAFT_KEY);
    } catch {
      /* no saved progress */
    }
    setReady(true);
  }, [ready, editing, shop, user]);

  useEffect(() => {
    if (!ready || editing || opened || !user) return;
    try {
      window.localStorage.setItem(SHOP_DRAFT_KEY, JSON.stringify({ ...draft, userId: user.id }));
    } catch {
      /* private mode */
    }
  }, [ready, editing, opened, user, draft]);

  // One object URL per picked logo, revoked when it changes.
  const logoUrl = useMemo(() => (logo ? URL.createObjectURL(logo) : null), [logo]);
  useEffect(() => () => {
    if (logoUrl) URL.revokeObjectURL(logoUrl);
  }, [logoUrl]);
  const previewUrl = logoUrl ?? shop?.logoUrl ?? null;

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const step = draft.step;
  const index = STEPS.indexOf(step);
  const next = () => update({ step: editing ? "review" : STEPS[Math.min(index + 1, STEPS.length - 1)] });
  const back = () => {
    if (editing && step !== "review") return update({ step: "review" });
    if (index > 0 && !editing) update({ step: STEPS[index - 1] });
    else router.push(editing ? `/shops/${shopId}` : "/profile");
  };

  const save = useMutation({
    mutationFn: () => {
      const input: ShopInput = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        categoryId: draft.categoryId as number,
        latitude: draft.latitude as number,
        longitude: draft.longitude as number,
        addressLine: draft.addressLine.trim(),
        phone: draft.phone.trim(),
        phonePublic: draft.phonePublic,
        hours: draft.hours,
        logo,
        cover,
      };
      return editing ? updateShop(shopId as number, input) : createShop(input);
    },
    onMutate: () => {
      setErrorKey(null);
      setDuplicateId(null);
    },
    onSuccess: async (saved) => {
      qc.invalidateQueries({ queryKey: ["my-shops"] });
      qc.setQueryData(["shop", saved.id], saved);
      await refresh();
      if (editing) {
        router.push(`/shops/${saved.id}`);
      } else {
        try {
          window.localStorage.removeItem(SHOP_DRAFT_KEY);
        } catch {
          /* ignore */
        }
        setOpened(saved);
      }
    },
    onError: (err) => {
      const code = err instanceof ApiError ? err.code : undefined;
      // Owner rule (1.1.6): the gate replaces the form.
      if (code === EMAIL_UNCONFIRMED) return markEmailUnconfirmed(user, setUser);
      const dup = err instanceof ApiError ? err.details.duplicate_shop_id : undefined;
      setDuplicateId(code === "shop_duplicate" && typeof dup === "number" ? dup : null);
      setErrorKey(
        code === "shop_duplicate"
          ? "form.review.duplicate"
          : err instanceof ApiError && err.status === 429
            ? "form.review.tooMany"
            : code === "outside_service_area"
              ? "form.location.outside"
              : "form.review.failed",
      );
    },
  });

  if (opened) return <ShopOpened shop={opened} />;
  if (!ready) return <div className="mx-auto min-h-[60vh] max-w-5xl" />;

  const category = top.find((c) => c.id === draft.categoryId);
  const allReady = STEPS.every((s) => stepComplete(s, draft));
  let content: React.ReactNode = null;
  let showContinue = true;

  switch (step) {
    case "why":
      content = (
        <div className="space-y-5">
          <Store className="mx-auto size-14 text-primary" />
          <h1 className="text-2xl font-extrabold">{t("form.why.title")}</h1>
          <ul className="space-y-3">
            {(
              [
                ["name", Store],
                ["visit", MapPin],
                ["badge", BadgeCheck],
              ] as const
            ).map(([k, Icon]) => (
              <li key={k} className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="size-5 text-primary" />
                </span>
                {t(`form.why.${k}`)}
              </li>
            ))}
          </ul>
          <Button variant="ghost" asChild className="w-full" data-testid="shop-form-not-now">
            <Link href="/profile">{t("form.notNow")}</Link>
          </Button>
        </div>
      );
      break;
    case "name":
      content = (
        <div className="space-y-4">
          <h1 className="text-2xl font-extrabold">{t("form.name.title")}</h1>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">{t("form.name.nameLabel")}</span>
            <Input value={draft.name} maxLength={50} dir="auto" onChange={(e) => update({ name: e.target.value })} onBlur={() => setTouched((x) => ({ ...x, name: true }))} data-testid="shop-form-name-input" />
            {touched.name && !nameValid(draft.name) && <span className="block text-sm text-destructive">{t("form.name.nameError")}</span>}
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">{t("form.name.descriptionLabel")}</span>
            <Textarea value={draft.description} maxLength={160} dir="auto" onChange={(e) => update({ description: e.target.value })} data-testid="shop-form-description" />
          </label>
        </div>
      );
      break;
    case "category":
      showContinue = draft.categoryId != null;
      content = (
        <div className="space-y-4">
          <h1 className="text-2xl font-extrabold">{t("form.category.title")}</h1>
          <p className="text-muted-foreground">{t("form.category.subtitle")}</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {top.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={draft.categoryId === c.id}
                onClick={() => update({ categoryId: c.id, step: editing ? "review" : "logo" })}
                data-testid={`shop-form-category-${c.slug}`}
                className={cn("flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border bg-card p-2 text-center hover:bg-accent", draft.categoryId === c.id && "border-2 border-primary")}
              >
                <span className="text-3xl">{c.icon ?? "🏷️"}</span>
                <span className="line-clamp-2 text-xs font-semibold">{categoryName(c, locale)}</span>
              </button>
            ))}
          </div>
        </div>
      );
      break;
    case "logo":
      content = (
        <div className="space-y-4">
          <h1 className="text-2xl font-extrabold">{t("form.logo.title")}</h1>
          <p className="text-muted-foreground">{t("form.logo.subtitle")}</p>
          <ImagePick label={t("form.logo.logo")} file={logo} existing={shop?.logoUrl} square onPick={setLogo} testId="shop-form-logo" />
          <ImagePick label={t("form.logo.cover")} file={cover} existing={shop?.coverUrl} onPick={setCover} testId="shop-form-cover" />
          {!logo && !shop?.logoUrl && <p className="text-sm text-muted-foreground">{t("form.logo.skipHint")}</p>}
        </div>
      );
      break;
    case "location": {
      const pinErr = touched.location && (draft.latitude == null || draft.longitude == null);
      const addrErr = touched.location && !draft.addressLine.trim();
      content = (
        <div className="space-y-4">
          <h1 className="text-2xl font-extrabold">{t("form.location.title")}</h1>
          <p className="text-muted-foreground">{t("form.location.subtitle")}</p>
          <div data-testid="shop-form-pin">
            <LocationMap lat={draft.latitude} lng={draft.longitude} editable searchable className="h-72 rounded-lg" onChange={(lat, lng) => update({ latitude: lat, longitude: lng })} />
          </div>
          {pinErr && <p className="text-sm text-destructive">{t("form.location.pinError")}</p>}
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">{t("form.location.addressLabel")}</span>
            <Input value={draft.addressLine} maxLength={160} dir="auto" placeholder={t("form.location.addressHint")} onChange={(e) => update({ addressLine: e.target.value })} onBlur={() => setTouched((x) => ({ ...x, location: true }))} data-testid="shop-form-address-input" />
            {addrErr && <span className="block text-sm text-destructive">{t("form.location.addressError")}</span>}
          </label>
          {errorKey === "form.location.outside" && <p className="text-sm text-destructive">{t(errorKey)}</p>}
        </div>
      );
      break;
    }
    case "hours": {
      const current = draft.hoursPreset ?? (Object.keys(draft.hours).length ? "custom" : "none");
      const setDay = (day: ShopDay, ranges: [string, string][]) => update({ hoursPreset: "custom", hours: { ...draft.hours, [day]: ranges } });
      const presetId = { satThu: "sat_thu", everyDay: "every_day", custom: "custom", none: "none" } as const;
      content = (
        <div className="space-y-3">
          <h1 className="text-2xl font-extrabold">{t("form.hours.title")}</h1>
          <p className="text-muted-foreground">{t("form.hours.subtitle")}</p>
          {(["satThu", "everyDay", "custom", "none"] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={current === p}
              data-testid={`shop-form-hours-preset-${presetId[p]}`}
              onClick={() =>
                p === "none"
                  ? update({ hoursPreset: null, hours: {} })
                  : p === "custom"
                    ? update({ hoursPreset: "custom", hours: Object.keys(draft.hours).length ? draft.hours : presetHours("satThu") })
                    : update({ hoursPreset: p, hours: presetHours(p) })
              }
              className={cn("flex w-full items-center justify-between rounded-xl border bg-card p-3.5 text-start hover:bg-accent", current === p && "border-2 border-primary")}
            >
              {t(`form.hours.${p}`)}
              {current === p && <Check className="size-4 text-primary" />}
            </button>
          ))}
          {current === "custom" && (
            <p className="text-xs text-muted-foreground" data-testid="shop-form-overnight-hint">
              {t("form.hours.overnightHint")}
            </p>
          )}
          {current === "custom" &&
            SHOP_DAYS.map((day) => {
              const ranges = draft.hours[day] ?? [];
              const open = ranges.length > 0;
              const [from, to] = ranges[0] ?? ["08:00", "18:00"];
              return (
                <div key={day} className="flex flex-wrap items-center gap-2" data-testid={`shop-form-day-${day}`}>
                  <label className="flex w-36 items-center gap-2 text-sm">
                    <input type="checkbox" checked={open} onChange={(e) => setDay(day, e.target.checked ? [["08:00", "18:00"]] : [])} data-testid={`shop-form-day-${day}-toggle`} />
                    {t(`days.${day}`)}
                  </label>
                  {open ? (
                    <>
                      {([0, 1] as const).map((i) => (
                        <Input
                          key={i}
                          type="time"
                          className="w-28"
                          value={i === 0 ? from : to}
                          aria-label={t(i === 0 ? "form.hours.from" : "form.hours.to")}
                          onChange={(e) => {
                            const v = normalizeDigits(e.target.value).slice(0, 5);
                            setDay(day, [i === 0 ? [v, to] : [from, v]]);
                          }}
                          data-testid={`shop-form-day-${day}-${i === 0 ? "from" : "to"}`}
                        />
                      ))}
                      {!isValidRange([from, to]) && <span className="text-sm text-destructive">{t("form.hours.rangeError")}</span>}
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">{t("form.hours.closedDay")}</span>
                  )}
                </div>
              );
            })}
        </div>
      );
      break;
    }
    case "contact":
      content = (
        <div className="space-y-4">
          <h1 className="text-2xl font-extrabold">{t("form.contact.title")}</h1>
          <p className="text-muted-foreground">{t("form.contact.subtitle")}</p>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">{t("form.contact.phoneLabel")}</span>
            <Input value={draft.phone} type="tel" maxLength={30} onChange={(e) => update({ phone: e.target.value })} data-testid="shop-form-phone" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.phonePublic} onChange={(e) => update({ phonePublic: e.target.checked })} data-testid="shop-form-phone-public" />
            {t("form.contact.showPhone")}
          </label>
        </div>
      );
      break;
    case "review": {
      showContinue = false;
      const notAdded = t("form.review.notAdded");
      const hoursLabel = draft.hoursPreset && draft.hoursPreset !== "custom" ? t(`form.hours.${draft.hoursPreset}`) : Object.keys(draft.hours).length ? t("form.hours.custom") : notAdded;
      const block = (id: string, label: string, value: string, target: Step) => (
        <div key={id} className="space-y-1 rounded-xl border bg-card p-3.5" data-testid={`shop-form-review-${id}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{label}</span>
            <button type="button" onClick={() => update({ step: target })} aria-label={t("form.edit")} data-testid={`shop-form-edit-${id}`}>
              <Pencil className="size-4 text-primary" />
            </button>
          </div>
          <p className="font-semibold" dir="auto">{value}</p>
        </div>
      );
      content = (
        <div className="space-y-3">
          <h1 className="text-2xl font-extrabold">{t("form.review.title")}</h1>
          {block("basics", t("form.review.basics"), `${draft.name}${category ? ` · ${categoryName(category, locale)}` : ""}`, "name")}
          {block("place", t("form.review.place"), draft.addressLine || notAdded, "location")}
          {block("hours", t("form.review.hours"), hoursLabel, "hours")}
          {block("contact", t("form.review.contact"), draft.phone || notAdded, "contact")}
          {errorKey && <p className="text-sm text-destructive" role="alert">{t(errorKey)}</p>}
          {duplicateId && duplicateId !== shopId && (
            <Button asChild variant="outline" className="w-full" data-testid="shop-form-open-duplicate">
              <Link href={`/shops/${duplicateId}`}>{t("form.review.openDuplicate")}</Link>
            </Button>
          )}
          <Button className="w-full" disabled={!allReady || save.isPending} onClick={() => save.mutate()} data-testid="shop-form-open">
            {editing ? t("form.review.save") : t("form.review.submit")}
          </Button>
        </div>
      );
      break;
    }
  }

  const canContinue = stepComplete(step, draft);

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-6 md:grid-cols-[1fr_320px]">
      <div>
        <div className="mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <button type="button" onClick={back} aria-label={t("form.back")} data-testid="shop-form-back">
              <ArrowLeft className="size-5 rtl:-scale-x-100" />
            </button>
            <span className="text-sm text-muted-foreground" data-testid="shop-form-progress-label">
              {t("form.progress", { step: index + 1, total: STEPS.length })}
            </span>
            <Link href={editing ? `/shops/${shopId}` : "/profile"} aria-label={t("form.close")} data-testid="shop-form-close">
              <X className="size-5" />
            </Link>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={STEPS.length} aria-valuenow={index + 1}>
            <div className="h-full bg-primary transition-[width]" style={{ width: `${((index + 1) / STEPS.length) * 100}%` }} />
          </div>
        </div>
        {content}
        {showContinue && (
          <Button
            className="mt-8 w-full"
            data-testid="shop-form-next"
            disabled={step !== "location" && step !== "name" && !canContinue}
            onClick={() => {
              if (step === "location" || step === "name") setTouched((x) => ({ ...x, [step]: true }));
              if (canContinue) next();
            }}
          >
            {step === "why" ? t("form.start") : t("form.next")}
            <ChevronRight className="size-4 rtl:-scale-x-100" />
          </Button>
        )}
      </div>
      {/* Desktop: the live preview of the shop header. */}
      <aside className="hidden md:block">
        <div className="sticky top-24 space-y-2 rounded-xl border bg-card p-4" data-testid="shop-form-preview">
          <span className="text-xs font-semibold uppercase text-muted-foreground">{t("form.name.preview")}</span>
          <UserIdentity variant="shop" name={draft.name.trim() || t("form.name.preview")} avatarUrl={previewUrl} subtitle={category ? categoryName(category, locale) : draft.description || undefined} size={52} />
        </div>
      </aside>
    </div>
  );
}
