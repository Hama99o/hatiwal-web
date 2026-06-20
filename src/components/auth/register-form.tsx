"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { AuthCard } from "./auth-card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function RegisterForm() {
  const t = useTranslations();
  const router = useRouter();
  const { register: registerUser, status } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authed") router.replace("/profile");
  }, [status, router]);

  const schema = z
    .object({
      firstname: z.string().min(1, t("auth.fieldRequired")),
      lastname: z.string().min(1, t("auth.fieldRequired")),
      email: z.string().email(t("auth.emailInvalid")),
      password: z.string().min(8, t("auth.passwordMin")),
      passwordConfirmation: z.string().min(1, t("auth.fieldRequired")),
    })
    .refine((d) => d.password === d.passwordConfirmation, {
      message: t("auth.passwordMismatch"),
      path: ["passwordConfirmation"],
    });
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstname: "",
      lastname: "",
      email: "",
      password: "",
      passwordConfirmation: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const res = await registerUser(values);
    // On success the redirect effect fires (status → "authed").
    if (!res.ok) {
      const full = res.errors?.full_messages;
      setFormError(
        full && full.length ? full.join(". ") : t("auth.registerError"),
      );
    }
  });

  return (
    <AuthCard
      title={t("auth.createAccount")}
      subtitle={t("auth.subtitle")}
      footerText={t("auth.hasAccount")}
      footerLinkLabel={t("auth.login")}
      footerHref="/login"
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {formError && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field
            label={t("auth.firstname")}
            htmlFor="firstname"
            error={errors.firstname?.message}
          >
            <Input id="firstname" autoComplete="given-name" {...register("firstname")} />
          </Field>
          <Field
            label={t("auth.lastname")}
            htmlFor="lastname"
            error={errors.lastname?.message}
          >
            <Input id="lastname" autoComplete="family-name" {...register("lastname")} />
          </Field>
        </div>
        <Field label={t("auth.email")} htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
        </Field>
        <Field
          label={t("auth.password")}
          htmlFor="password"
          error={errors.password?.message}
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            {...register("password")}
          />
        </Field>
        <Field
          label={t("auth.confirmPassword")}
          htmlFor="passwordConfirmation"
          error={errors.passwordConfirmation?.message}
        >
          <Input
            id="passwordConfirmation"
            type="password"
            autoComplete="new-password"
            {...register("passwordConfirmation")}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {t("auth.registerButton")}
        </Button>
      </form>
    </AuthCard>
  );
}
