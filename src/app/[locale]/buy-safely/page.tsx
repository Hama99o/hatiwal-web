import type { Metadata } from "next";
import { Check } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localizedAlternates } from "@/lib/seo";
import { CITY_SLUGS } from "@/lib/cities";
import { GuidePage, GuideSection } from "@/components/guides/guide-page";

// A static guide (docs/SEO.md). The meeting checklist is the app's own
// "Meetup safety tips" (messages `safety.tips`), the same text the listing
// page shows, so the two never disagree.
export const revalidate = 3600;

const MEET_TIPS = ["publicPlace", "daylight", "bringFriend", "inspectItem", "trustInstincts"] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "guides.buy" });
  const alternates = localizedAlternates(locale, "/buy-safely");
  const title = t("metaTitle");
  const description = t("metaDescription");
  return {
    title,
    description,
    alternates,
    openGraph: { title, description, url: alternates.canonical as string, type: "article" },
  };
}

export default async function BuySafelyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <GuidePage
      testId="guide-buy-safely"
      title={t("guides.buy.title")}
      intro={t("guides.buy.intro")}
      cta={{ href: "/bazaar", label: t("guides.buy.startCta") }}
      relatedTitle={t("guides.relatedTitle")}
      related={[
        { href: "/how-to-sell", label: t("guides.sell.title") },
        { href: "/prohibited-items", label: t("footer.prohibitedItems") },
        { href: "/download", label: t("nav.getApp") },
        ...CITY_SLUGS.map((slug) => ({
          href: `/cities/${slug}`,
          label: t("cities.title", { city: t(`cities.names.${slug}`) }),
        })),
      ]}
    >
      <GuideSection title={t("guides.buy.chatTitle")} id="chat">
        <p>{t("guides.buy.chatBody")}</p>
      </GuideSection>
      <GuideSection title={t("guides.buy.sellerTitle")} id="seller">
        <p>{t("guides.buy.sellerBody")}</p>
      </GuideSection>
      <GuideSection title={t("guides.buy.meetTitle")} id="meet">
        <ul className="space-y-3">
          {MEET_TIPS.map((key) => (
            <li key={key} className="flex gap-2">
              <Check className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
              <span>{t(`safety.tips.${key}`)}</span>
            </li>
          ))}
        </ul>
      </GuideSection>
      <GuideSection title={t("guides.buy.payTitle")} id="pay">
        <p>{t("guides.buy.payBody")}</p>
        <p>{t("safety.tips.noAdvancePayment")}</p>
      </GuideSection>
      <GuideSection title={t("guides.buy.reportTitle")} id="report">
        <p>{t("guides.buy.reportBody")}</p>
      </GuideSection>
    </GuidePage>
  );
}
