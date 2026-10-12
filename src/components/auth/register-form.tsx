"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { authFailureKey, useAuth } from "@/components/auth/auth-provider";
import { AuthCard } from "./auth-card";
import { isInviteToken } from "@/lib/api/shop-team";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/lib/use-hydrated";

export function RegisterForm() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { register: registerUser, status } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  // SHOP-3: a sign-up that started from a team invite (/signup?invite=<token>)
  // carries the token and lands back on that invite's Join page.
  // Read after mount (not in render): the server render has no URL to read.
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("invite");
    if (isInviteToken(t)) setInviteToken(t);
  }, []);
  useEffect(() => {
    if (status === "authed") router.replace(inviteToken ? `/join/${inviteToken}` : "/profile");
  }, [status, router, inviteToken]);

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
  const hydrated = useHydrated();

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    // Sign up in the language you are actually reading the site in.
    const res = await registerUser({
      ...values,
      preferredLanguage: locale as "en" | "ps" | "fa",
      ...(inviteToken ? { inviteToken } : {}),
    });
    // On success the redirect effect fires (status → "authed").
    if (!res.ok) {
      const shared = authFailureKey(res.error);
      const full = res.errors?.full_messages;
      setFormError(
        shared ? t(shared) : full && full.length ? full.join(". ") : t("auth.registerError"),
      );
    }
  });

  return (
    <AuthCard
      title={t("auth.createAccount")}
      subtitle={t("auth.subtitle")}
      footerText={t("auth.hasAccount")}
      footerLinkLabel={t("auth.login")}
      footerHref={inviteToken ? `/login?next=${encodeURIComponent(`/join/${inviteToken}`)}` : "/login"}
    >
      <form method="post" onSubmit={onSubmit} className="space-y-4" noValidate>
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
        <Button type="submit" className="w-full" disabled={!hydrated || isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {t("auth.registerButton")}
        </Button>
      </form>
    </AuthCard>
  );
}
