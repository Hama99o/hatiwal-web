"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { authFailureKey, useAuth } from "@/components/auth/auth-provider";
import { AuthCard } from "./auth-card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/lib/use-hydrated";

export function ForgotPasswordForm() {
  const t = useTranslations();
  const { forgotPassword } = useAuth();
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
  const hydrated = useHydrated();

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const res = await forgotPassword(values.email);
    // "Link sent" only when the request reached Rails; offline / 429 / a server
    // failure say so (nothing about whether the address exists).
    if (!res.ok) {
      setFormError(t(authFailureKey(res.error) ?? "common.somethingWrong"));
      return;
    }
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
        <form method="post" onSubmit={onSubmit} className="space-y-4" noValidate>
          {formError && (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {formError}
            </p>
          )}
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
          <Button type="submit" className="w-full" disabled={!hydrated || isSubmitting}>
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
