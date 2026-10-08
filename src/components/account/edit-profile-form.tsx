"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Camera, Loader2, PlaneTakeoff } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { updateAvatar, updateProfile, type ProfileUpdate } from "@/lib/api/me";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function EditProfileForm() {
  const t = useTranslations();
  const router = useRouter();
  const { user, setUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  // Owner, 2026-10-08: a picked photo is only a PREVIEW; Save uploads it (first,
  // then the fields), like every other field on this page. Same as mobile.
  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!pendingAvatar) return setPreviewUrl(null);
    const url = URL.createObjectURL(pendingAvatar);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingAvatar]);

  function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error(t("profile.edit.photoTooLarge"));
      return;
    }
    setPendingAvatar(file);
  }

  const displayName =
    user?.fullName || `${user?.firstname ?? ""} ${user?.lastname ?? ""}`.trim();

  const schema = z.object({
    firstname: z.string().min(1, t("profile.edit.validation.firstnameRequired")),
    lastname: z.string().min(1, t("profile.edit.validation.lastnameRequired")),
    phone: z
      .string()
      .max(20, t("profile.edit.validation.phoneTooLong"))
      .optional()
      .or(z.literal("")),
    bio: z
      .string()
      .max(500, t("profile.edit.validation.bioTooLong"))
      .optional()
      .or(z.literal("")),
    city: z.string().optional().or(z.literal("")),
    province: z.string().optional().or(z.literal("")),
    preferredLanguage: z.enum(["en", "ps", "fa"]),
    // Away mode (W713): toggle + a YYYY-MM-DD end date from the native picker.
    // A SEPARATE WhatsApp number — often a different SIM from `phone`.
    whatsappNumber: z
      .string()
      .max(30, t("profile.edit.validation.whatsappTooLong"))
      .optional()
      .or(z.literal("")),
    showPhonePublicly: z.boolean(),
    showAddressPublicly: z.boolean(),
    isAway: z.boolean(),
    awayUntilDate: z.string().optional().or(z.literal("")),
  });
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstname: user?.firstname ?? "",
      lastname: user?.lastname ?? "",
      phone: user?.phone ?? "",
      whatsappNumber: user?.whatsappNumber ?? "",
      // `?? true` matches the column defaults: an undefined from an older
      // response must never read as "hidden", which would silently withdraw the
      // seller's phone from their own listings.
      showPhonePublicly: user?.showPhonePublicly ?? true,
      showAddressPublicly: user?.showAddressPublicly ?? true,
      bio: user?.bio ?? "",
      city: user?.city ?? "",
      province: user?.province ?? "",
      preferredLanguage: user?.preferredLanguage ?? "en",
      // Backend only surfaces awayUntil while the seller is currently away, so
      // its presence is the source of truth for the toggle's initial state.
      isAway: !!user?.awayUntil,
      awayUntilDate: user?.awayUntil ? user.awayUntil.slice(0, 10) : "",
    },
  });

  // Today (YYYY-MM-DD) as the min selectable away date — the backend rejects a
  // past away_until, so we prevent it in the picker too.
  const todayIso = new Date().toISOString().slice(0, 10);
  const isAway = watch("isAway");

  const onSubmit = handleSubmit(async (values) => {
    const { isAway: away, awayUntilDate, ...rest } = values;
    const payload: ProfileUpdate = { ...rest };
    // Mirror mobile: away on + date → set end-of-day UTC; away off → clear
    // (explicit null); away on but no date → omit so we don't overwrite.
    if (away && awayUntilDate) {
      payload.awayUntil = `${awayUntilDate}T23:59:59.000Z`;
    } else if (!away) {
      payload.awayUntil = null;
    }
    if (pendingAvatar) {
      try {
        setUser(await updateAvatar(pendingAvatar));
      } catch {
        toast.error(t("profile.edit.photoError"));
        return; // nothing else saved: the form and the photo stay as they are
      }
    }
    try {
      const updated = await updateProfile(payload);
      setUser(updated);
      toast.success(t("profile.edit.saved"));
      router.push("/profile");
    } catch {
      toast.error(t("profile.edit.saveError"));
    }
  });

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      {/* Top bar (owner, 2026-10-08): the title and Save, always in reach. Sticks
          right under the site header (64px + border; + the 52px search row below md). */}
      <div className="sticky top-[117px] z-30 -mx-4 mb-6 flex items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:top-[65px]">
        <h1 className="min-w-0 truncate text-xl font-bold sm:text-2xl">{t("profile.edit.title")}</h1>
        <Button type="submit" form="edit-profile-form" disabled={isSubmitting} data-testid="edit-profile-save">
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {t("common.save")}
        </Button>
      </div>

      {/* Avatar */}
      <div className="mb-6 flex items-center gap-4">
        <div className="relative">
          <UserAvatar
            name={displayName}
            avatarUrl={previewUrl ?? user?.avatarUrl}
            size={72}
          />
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickAvatar}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            data-testid="edit-profile-photo"
          >
            <Camera className="size-4" />
            {t("profile.edit.changePhoto")}
          </Button>
        </div>
      </div>

      <form id="edit-profile-form" onSubmit={onSubmit} className="space-y-5" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label={t("profile.edit.fields.firstname")}
            htmlFor="firstname"
            error={errors.firstname?.message}
          >
            <Input id="firstname" {...register("firstname")} />
          </Field>
          <Field
            label={t("profile.edit.fields.lastname")}
            htmlFor="lastname"
            error={errors.lastname?.message}
          >
            <Input id="lastname" {...register("lastname")} />
          </Field>
        </div>

        <Field
          label={t("profile.edit.fields.phone")}
          htmlFor="phone"
          error={errors.phone?.message}
        >
          <Input id="phone" inputMode="tel" {...register("phone")} />
        </Field>

        {/* WhatsApp — a separate number, plus a one-tap copy of the phone.
            Owner request, 2026-09-02: "give posibilites to add same number as
            whatapp option also". */}
        <Field
          label={t("profile.edit.fields.whatsapp")}
          htmlFor="whatsappNumber"
          error={errors.whatsappNumber?.message}
        >
          <Input id="whatsappNumber" inputMode="tel" {...register("whatsappNumber")} />
          {watch("phone") && watch("whatsappNumber") !== watch("phone") ? (
            <button
              type="button"
              onClick={() =>
                setValue("whatsappNumber", watch("phone") ?? "", { shouldDirty: true })
              }
              className="mt-1.5 text-sm text-primary underline-offset-2 hover:underline"
            >
              {t("profile.edit.fields.whatsappSameAsPhone")}
            </button>
          ) : null}
        </Field>

        {/* Who can see my contact details.
            Owner request, 2026-09-02: "show option to show number and address to
            people or not — I mean user address not list address its important".
            The note below states that distinction, since it is what a seller
            would otherwise get wrong: hiding your own address must not hide
            where an item can be collected. */}
        <div className="space-y-2 rounded-lg border border-border p-3">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span className="text-sm">{t("profile.edit.fields.showPhonePublicly")}</span>
            <input
              type="checkbox"
              className="size-5 shrink-0 accent-primary"
              {...register("showPhonePublicly")}
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span className="text-sm">{t("profile.edit.fields.showAddressPublicly")}</span>
            <input
              type="checkbox"
              className="size-5 shrink-0 accent-primary"
              {...register("showAddressPublicly")}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            {t("profile.edit.fields.visibilityNote")}
          </p>
        </div>

        <Field
          label={t("profile.edit.fields.bio")}
          htmlFor="bio"
          error={errors.bio?.message}
        >
          <Textarea
            id="bio"
            rows={3}
            placeholder={t("profile.edit.fields.bioPlaceholder")}
            {...register("bio")}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label={t("profile.edit.fields.city")}
            htmlFor="city"
            error={errors.city?.message}
          >
            <Input id="city" {...register("city")} />
          </Field>
          <Field
            label={t("profile.edit.fields.province")}
            htmlFor="province"
            error={errors.province?.message}
          >
            <Input id="province" {...register("province")} />
          </Field>
        </div>

        <Field
          label={t("profile.edit.sections.language")}
          htmlFor="preferredLanguage"
        >
          <select
            id="preferredLanguage"
            className={SELECT_CLASS}
            {...register("preferredLanguage")}
          >
            <option value="en">{t("profile.edit.language.en")}</option>
            <option value="ps">{t("profile.edit.language.ps")}</option>
            <option value="fa">{t("profile.edit.language.fa")}</option>
          </select>
        </Field>

        {/* Away mode (W713) — set/clear a temporary away-until date. */}
        <div className="space-y-3 rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2">
            <PlaneTakeoff className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">
              {t("profile.away.sectionTitle")}
            </h2>
          </div>
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span className="text-sm">{t("profile.away.toggle")}</span>
            <input
              type="checkbox"
              className="size-5 shrink-0 accent-primary"
              {...register("isAway")}
            />
          </label>
          {isAway && (
            <Field label={t("profile.away.untilLabel")} htmlFor="awayUntilDate">
              <Input
                id="awayUntilDate"
                type="date"
                min={todayIso}
                {...register("awayUntilDate")}
              />
            </Field>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => router.push("/profile")}
        >
          {t("common.cancel")}
        </Button>
      </form>
    </div>
  );
}
