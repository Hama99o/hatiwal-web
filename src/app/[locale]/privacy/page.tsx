import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localizedAlternates } from "@/lib/seo";
import { SUPPORT_EMAIL } from "@/lib/app-links";
import { Link } from "@/i18n/navigation";

// Public, SEO-indexable privacy policy — required by the App Store and Google
// Play (a reachable policy URL must be declared in both consoles).
// NOTE(owner): review this text with your needs before launch; it is an
// accurate starting policy for the data the app actually collects.
export const revalidate = 60;


export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "privacy" });
  return {
    title: t("title"),
    alternates: localizedAlternates(locale, "/privacy"),
  };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "privacy" });

  // 1.1.6, approved by the owner on 2026-10-09: verification (VER-1, e-Tazkira
  // only + a shop's proof of business), location (LOC-1), shops (SHOP-1/2/3:
  // buyers see the shop, not the owner's personal details; a closed shop's
  // past messages keep the shop's name) and photo variants (smaller copies).
  // Sources: hatiwal-mobile docs/VERIFICATION_PRIVACY_DRAFT.md and
  // docs/PRIVACY_1.1.6_DRAFT.md. ps/fa/ur are translations: they say so at the
  // top and link to the English text, which applies (owner, option B).
  const sections: { title: string; body: string; extra?: string }[] = [
    { title: t("collectTitle"), body: t("collectBody") },
    { title: t("verifyTitle"), body: t("verifyBody") },
    { title: t("locationTitle"), body: t("locationBody") },
    { title: t("shopsTitle"), body: t("shopsBody") },
    { title: t("useTitle"), body: t("useBody") },
    { title: t("shareTitle"), body: t("shareBody") },
    { title: t("retentionTitle"), body: t("retentionBody"), extra: t("retentionVerify") },
    { title: t("choicesTitle"), body: t("choicesBody") },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t("title")}</h1>
      <p className="mt-1 text-xs text-muted-foreground">{t("lastUpdated")}</p>
      {locale !== "en" && (
        <p className="mt-3 rounded-md border bg-muted/40 px-3 py-2 text-sm" data-testid="privacy-translation-note">
          {t("translationNote")}{" "}
          <Link href="/privacy" locale="en" lang="en" dir="ltr" className="font-medium text-primary underline">
            {t("translationNoteLink")}
          </Link>
        </p>
      )}
      <p className="mt-4 text-muted-foreground">{t("intro")}</p>

      <div className="mt-8 space-y-6">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="text-lg font-semibold">{s.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            {s.extra && <p className="mt-2 text-sm text-muted-foreground">{s.extra}</p>}
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
