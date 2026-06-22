"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { AuthCard } from "./auth-card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  token: string | null;
}

export function ResetPasswordForm({ token }: Props) {
  const t = useTranslations();
  const { resetPassword } = useAuth();
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const schema = z
    .object({
      password: z.string().min(8, t("auth.passwordMin")),
      passwordConfirmation: z.string().min(1, t("auth.fieldRequired")),
    })
    .refine((data) => data.password === data.passwordConfirmation, {
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
    defaultValues: { password: "", passwordConfirmation: "" },
  });

  // No token — show an error with link to request a new one
  if (!token) {
    return (
      <AuthCard
        title={t("auth.resetPasswordTitle")}
        footerText={t("auth.hasAccount")}
        footerLinkLabel={t("auth.loginButton")}
        footerHref="/login"
      >
        <div className="space-y-4 text-center">
          <p className="rounded-md bg-destructive/10 px-3 py-3 text-sm text-destructive">
            {t("auth.resetPasswordError")}
          </p>
          <Link
            href="/forgot-password"
            className="inline-block text-sm font-medium text-primary hover:underline"
          >
            {t("auth.sendResetLink")}
          </Link>
        </div>
      </AuthCard>
    );
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const res = await resetPassword(
      token,
      values.password,
      values.passwordConfirmation,
    );
    if (res.ok) {
      setSuccess(true);
    } else {
      setFormError(t("auth.resetPasswordError"));
    }
  });

  return (
    <AuthCard
      title={t("auth.resetPasswordTitle")}
      subtitle={success ? undefined : t("auth.resetPasswordSubtitle")}
      footerText={t("auth.hasAccount")}
      footerLinkLabel={t("auth.loginButton")}
      footerHref="/login"
    >
      {success ? (
        <div className="space-y-4 text-center">
          <p className="rounded-md bg-success/10 px-3 py-3 text-sm text-success">
            {t("auth.resetPasswordSuccess")}
          </p>
          <Link
            href="/login"
            className="inline-block text-sm font-medium text-primary hover:underline"
          >
            {t("auth.loginButton")}
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {formError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          )}
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
            {t("auth.resetPassword")}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
