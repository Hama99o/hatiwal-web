"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import Script from "next/script";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { AuthCard } from "./auth-card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google: any;
  }
}

function GoogleSignInButton() {
  const t = useTranslations();
  const { googleLogin } = useAuth();
  const router = useRouter();
  const divRef = useRef<HTMLDivElement>(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const [googleError, setGoogleError] = useState<string | null>(null);
  // Flips when the GIS script is available — either via <Script onReady> or,
  // on remounts where the script tag already exists, via the effect below.
  const [gsiReady, setGsiReady] = useState(false);

  useEffect(() => {
    // lazyOnload loads AFTER the window "load" event, so a load-listener
    // fallback never fires and the button silently never renders. Poll for
    // window.google instead (covers remounts + slow networks), and let
    // <Script onReady> flip the flag on the normal first-load path.
    if (window.google) {
      setGsiReady(true);
      return;
    }
    const timer = setInterval(() => {
      if (window.google) {
        setGsiReady(true);
        clearInterval(timer);
      }
    }, 250);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!clientId || !gsiReady || !divRef.current || !window.google) return;
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response: { credential: string }) => {
        setGoogleError(null);
        const res = await googleLogin(response.credential);
        if (res.ok) {
          router.replace("/profile");
        } else {
          setGoogleError(t("auth.googleSignInFailed"));
        }
      },
    });
    window.google.accounts.id.renderButton(divRef.current, {
      theme: "outline",
      size: "large",
      width: divRef.current?.offsetWidth || 300,
      text: "continue_with",
    });
  }, [clientId, gsiReady, googleLogin, router, t]);

  if (!clientId) return null;

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setGsiReady(true)}
      />
      {googleError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {googleError}
        </p>
      )}
      <div ref={divRef} className="w-full" />
    </>
  );
}

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
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm text-primary hover:underline"
          >
            {t("auth.forgotPassword")}
          </Link>
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {t("auth.loginButton")}
        </Button>
        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              {t("auth.orDivider")}
            </span>
          </div>
        </div>
        <GoogleSignInButton />
      </form>
    </AuthCard>
  );
}
