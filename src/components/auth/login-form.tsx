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

export function LoginForm() {
  const t = useTranslations();
  const router = useRouter();
  const { login, status } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  // Redirect away once authenticated — covers both a fresh login and revisiting
  // /login while already signed in.
  useEffect(() => {
    if (status === "authed") router.replace("/profile");
  }, [status, router]);

  const schema = z.object({
    email: z.string().email(t("auth.emailInvalid")),
    password: z.string().min(1, t("auth.fieldRequired")),
  });
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const res = await login(values.email, values.password);
    if (res.ok) return; // redirect effect fires (status → "authed")
    if (res.error === "blocked") {
      const key = res.status === "banned" ? "banned" : "suspended";
      const reason = res.reason
        ? ` ${t("auth.blocked.reason", { reason: res.reason })}`
        : "";
      setFormError(`${t(`auth.blocked.${key}`)}${reason}`);
    } else {
      setFormError(t("auth.loginError"));
    }
  });

  return (
    <AuthCard
      title={t("auth.welcome")}
      subtitle={t("auth.subtitle")}
      footerText={t("auth.noAccount")}
      footerLinkLabel={t("auth.register")}
      footerHref="/signup"
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {formError && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        )}
        <Field label={t("auth.email")} htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            {...register("email")}
          />
        </Field>
        <Field
          label={t("auth.password")}
          htmlFor="password"
          error={errors.password?.message}
        >
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register("password")}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {t("auth.loginButton")}
        </Button>
      </form>
    </AuthCard>
  );
}
