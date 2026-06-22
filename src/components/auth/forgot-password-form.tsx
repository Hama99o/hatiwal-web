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

export function ForgotPasswordForm() {
  const t = useTranslations();
  const { forgotPassword } = useAuth();
  const [sent, setSent] = useState(false);

  const schema = z.object({
    email: z.string().email(t("auth.emailInvalid")),
  });
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    await forgotPassword(values.email);
    setSent(true);
  });

  return (
    <AuthCard
      title={t("auth.forgotPasswordTitle")}
      subtitle={sent ? undefined : t("auth.forgotPasswordSubtitle")}
      footerText={t("auth.hasAccount")}
      footerLinkLabel={t("auth.loginButton")}
      footerHref="/login"
    >
      {sent ? (
        <div className="space-y-4 text-center">
          <p className="rounded-md bg-success/10 px-3 py-3 text-sm text-success">
            {t("auth.resetLinkSent")}
          </p>
          <Link
            href="/login"
            className="inline-block text-sm font-medium text-primary hover:underline"
          >
            {t("auth.backToLogin")}
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field
            label={t("auth.email")}
            htmlFor="email"
            error={errors.email?.message}
          >
            <Input
              id="email"
              type="email"
              autoComplete="email"
              {...register("email")}
            />
          </Field>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            {t("auth.sendResetLink")}
          </Button>
          <div className="text-center">
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-primary hover:underline"
            >
              {t("auth.backToLogin")}
            </Link>
          </div>
        </form>
      )}
    </AuthCard>
  );
}
