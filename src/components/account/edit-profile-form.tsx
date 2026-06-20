"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { updateProfile } from "@/lib/api/me";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function EditProfileForm() {
  const t = useTranslations();
  const router = useRouter();
  const { user, setUser } = useAuth();

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
