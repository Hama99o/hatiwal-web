import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

// Public, SEO-indexable privacy policy — required by the App Store and Google
// Play (a reachable policy URL must be declared in both consoles).
// NOTE(owner): review this text with your needs before launch; it is an
// accurate starting policy for the data the app actually collects.
export const revalidate = 60;

// TODO(ops): point at the real support inbox before launch.
const SUPPORT_EMAIL = "support@hatiwal.app";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "privacy" });
  return { title: t("title") };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "privacy" });

  const sections: { title: string; body: string }[] = [
    { title: t("collectTitle"), body: t("collectBody") },
    { title: t("useTitle"), body: t("useBody") },
    { title: t("shareTitle"), body: t("shareBody") },
    { title: t("retentionTitle"), body: t("retentionBody") },
    { title: t("choicesTitle"), body: t("choicesBody") },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t("title")}</h1>
      <p className="mt-1 text-xs text-muted-foreground">{t("lastUpdated")}</p>
      <p className="mt-4 text-muted-foreground">{t("intro")}</p>

      <div className="mt-8 space-y-6">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="text-lg font-semibold">{s.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
          </section>
        ))}

        <section>
          <h2 className="text-lg font-semibold">{t("contactTitle")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("contactBody", { email: SUPPORT_EMAIL })}</p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="mt-2 inline-block font-medium text-primary underline"
          >
            {SUPPORT_EMAIL}
          </a>
        </section>
      </div>
    </div>
  );
}
