import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localizedAlternates } from "@/lib/seo";

// Public, SEO-indexable page describing how to delete a Hatiwal account and
// personal data — satisfies Google Play's requirement for a web-accessible
// account-deletion resource (reachable without installing the app).
export const revalidate = 60;

// TODO(ops): point this at the real support inbox before launch.
const SUPPORT_EMAIL = "support@hatiwal.app";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "deleteAccount" });
  return {
    title: t("title"),
    alternates: localizedAlternates(locale, "/delete-account"),
  };
}

export default async function DeleteAccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "deleteAccount" });

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t("title")}</h1>
      <p className="mt-3 text-muted-foreground">{t("intro")}</p>

      <section className="mt-8 rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">{t("inAppTitle")}</h2>
        <ol className="mt-3 list-decimal space-y-2 ps-5 text-sm text-foreground">
          <li>{t("step1")}</li>
          <li>{t("step2")}</li>
          <li>{t("step3")}</li>
        </ol>
      </section>

      <section className="mt-6 rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">{t("whatHappensTitle")}</h2>
        <p className="mt-3 text-sm text-muted-foreground">{t("whatHappensBody")}</p>
      </section>

      <section className="mt-6 rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">{t("noAppTitle")}</h2>
        <p className="mt-3 text-sm text-muted-foreground">{t("noAppBody", { email: SUPPORT_EMAIL })}</p>
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="mt-3 inline-block font-medium text-primary underline"
        >
          {SUPPORT_EMAIL}
        </a>
      </section>
    </div>
  );
}
