import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.confirmEmail" });
  return { title: t("pageTitle") };
}

/**
 * Where the confirmation email lands.
 *
 * The API confirms the account and then redirects here — `WEB_CONFIRM_URL`, which
 * defaults to https://hatiwal.com/email-confirmed. This page did not exist, so the
 * last thing a user saw after successfully confirming was a 404. The account was
 * fine; the experience said otherwise.
 *
 * DeviseTokenAuth appends `account_confirmation_success=true|false`, so both
 * outcomes are handled — a stale or already-used link is a normal thing to hit,
 * and it needs a way forward rather than a dead end.
 */
export default async function EmailConfirmedPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "auth.confirmEmail" });

  // Anything other than an explicit "false" is treated as success: the redirect
  // only happens after Devise has confirmed the token, and an absent flag on a
  // successful confirm should not be shown to the user as a failure.
  const failed = sp.account_confirmation_success === "false";

  return (
    <main className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      {failed ? (
        <AlertCircle className="size-12 text-amber-600 dark:text-amber-400" />
      ) : (
        <CheckCircle2 className="size-12 text-emerald-600 dark:text-emerald-400" />
      )}

      <h1 className="mt-4 text-xl font-semibold">
        {failed ? t("failTitle") : t("successTitle")}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {failed ? t("failBody") : t("successBody")}
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/bazaar"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          {t("goHome")}
        </Link>
        {/* On failure the way forward is the profile banner's resend button, so
            point at it rather than leaving the user to find it. */}
        {failed && (
          <Link
            href="/profile"
            className="rounded-lg border px-4 py-2 text-sm font-medium"
          >
            {t("goProfile")}
          </Link>
        )}
      </div>
    </main>
  );
}
