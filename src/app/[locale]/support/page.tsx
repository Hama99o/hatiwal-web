import type { Metadata } from "next";
import { Mail, MessageCircle } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localizedAlternates } from "@/lib/seo";
import { SUPPORT_EMAIL } from "@/lib/app-links";
import { Link } from "@/i18n/navigation";
import { GuidePage, GuideSection } from "@/components/guides/guide-page";
import { DownloadOptions } from "@/components/download/download-options";

// The Support URL declared in App Store Connect / Google Play (Apple guideline 1.5:
// it must lead to support information — hatiwal.com had none, iOS 1.1.9 was rejected
// for it on 2026-10-29). How to reach us (the app's own Support chat, by its labels
// in the app: Me → Help & support → Contact support; the same inbox as /privacy) and
// short answers that LINK to the guides instead of repeating them.
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "support" });
  const alternates = localizedAlternates(locale, "/support");
  const title = t("title");
  const description = t("description");
  return { title, description, alternates, openGraph: { title, description, url: alternates.canonical as string } };
}

const LINK = "font-medium text-primary underline";

export default async function SupportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <GuidePage
      testId="support-page"
      title={t("support.title")}
      intro={t("support.intro")}
      cta={{ href: "/download", label: t("nav.getApp") }}
      relatedTitle={t("guides.relatedTitle")}
      related={[
        { href: "/how-to-sell", label: t("footer.howToSell") },
        { href: "/buy-safely", label: t("footer.buySafely") },
        { href: "/prohibited-items", label: t("footer.prohibitedItems") },
        { href: "/privacy", label: t("footer.privacy") },
        { href: "/delete-account", label: t("footer.deleteAccount") },
      ]}
    >
      <GuideSection title={t("support.contactTitle")} id="contact">
        <p className="flex gap-2">
          <MessageCircle className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <span>
            {t.rich("support.contactInApp", {
              path: t("support.contactInAppPath"),
              b: (chunks) => <strong className="font-semibold text-foreground">{chunks}</strong>,
            })}
          </span>
        </p>
        <p className="flex flex-wrap items-center gap-2">
          <Mail className="size-5 shrink-0 text-primary" aria-hidden />
          <span>{t("support.contactEmail")}</span>
          <a href={`mailto:${SUPPORT_EMAIL}`} className={LINK} dir="ltr" data-testid="support-email">
            {SUPPORT_EMAIL}
          </a>
        </p>
      </GuideSection>

      <GuideSection title={t("support.faqTitle")} id="faq">
        <dl className="space-y-5">
          <div>
            <dt className="font-semibold text-foreground">{t("support.sellQ")}</dt>
            <dd className="mt-1">
              {t("support.sellA")}{" "}
              <Link href="/how-to-sell" className={LINK}>{t("footer.howToSell")}</Link>
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">{t("support.buyQ")}</dt>
            <dd className="mt-1">
              {t("support.buyA")}{" "}
              <Link href="/buy-safely" className={LINK}>{t("footer.buySafely")}</Link>
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">{t("support.paymentsQ")}</dt>
            <dd className="mt-1">{t("support.paymentsA")}</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">{t("support.reportQ")}</dt>
            <dd className="mt-1">{t("support.reportA")}</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">{t("support.deleteQ")}</dt>
            <dd className="mt-1">
              {t("support.deleteA")}{" "}
              <Link href="/delete-account" className={LINK}>{t("footer.deleteAccount")}</Link>
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">{t("support.privacyQ")}</dt>
            <dd className="mt-1">
              {t("support.privacyA")}{" "}
              <Link href="/privacy" className={LINK}>{t("footer.privacy")}</Link>
            </dd>
          </div>
        </dl>
      </GuideSection>

      <GuideSection title={t("support.downloadTitle")} id="download">
        <DownloadOptions />
      </GuideSection>
    </GuidePage>
  );
}
