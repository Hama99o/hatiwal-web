"use client";

import { useRef, useState } from "react";
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
import { Button } from "@/components/ui/button";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function EditProfileForm() {
  const t = useTranslations();
  const router = useRouter();
  const { user, setUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error(t("profile.edit.photoTooLarge"));
      return;
    }
    setUploadingAvatar(true);
    try {
      const updated = await updateAvatar(file);
      setUser(updated);
      toast.success(t("profile.edit.photoUpdated"));
    } catch {
      toast.error(t("profile.edit.photoError"));
    } finally {
      setUploadingAvatar(false);
    }
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
    isAway: z.boolean(),
    awayUntilDate: z.string().optional().or(z.literal("")),
  });
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstname: user?.firstname ?? "",
      lastname: user?.lastname ?? "",
      phone: user?.phone ?? "",
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
      <h1 className="mb-6 text-2xl font-bold">{t("profile.edit.title")}</h1>

      {/* Avatar */}
      <div className="mb-6 flex items-center gap-4">
        <div className="relative">
          <UserAvatar
            name={displayName}
            avatarUrl={user?.avatarUrl}
            size={72}
          />
          {uploadingAvatar && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
              <Loader2 className="size-5 animate-spin text-white" />
            </div>
          )}
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
            disabled={uploadingAvatar}
            onClick={() => fileRef.current?.click()}
          >
            <Camera className="size-4" />
            {t("profile.edit.changePhoto")}
          </Button>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
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

        <Field
          label={t("profile.edit.fields.bio")}
          htmlFor="bio"
          error={errors.bio?.message}
        >
          <textarea
            id="bio"
            rows={3}
            placeholder={t("profile.edit.fields.bioPlaceholder")}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            {t("profile.edit.saveButton")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/profile")}
          >
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </div>
  );
}
