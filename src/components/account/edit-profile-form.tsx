"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { updateAvatar, updateProfile } from "@/lib/api/me";
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
  });
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
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
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const updated = await updateProfile(values);
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
