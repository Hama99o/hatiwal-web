import type { Metadata } from "next";
import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  FileText,
  Handshake,
  MapPin,
  MessageCircle,
  Rocket,
  Tag,
  UserPlus,
  Video,
} from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { localizedAlternates } from "@/lib/seo";
import { MAX_LISTING_PHOTOS } from "@/lib/api/listings";
import { MAX_SHOP_PHOTOS } from "@/lib/api/shops";
import { MAX_VIDEO_DURATION_S } from "@/lib/listing-video";
import { CITY_SLUGS } from "@/lib/cities";
import { GuidePage, GuideSection, GuideSteps } from "@/components/guides/guide-page";

// A static guide (docs/SEO.md): every number in it comes from the same
// constant the product enforces, so the page cannot promise more photos or a
// longer video than the form accepts.
export const revalidate = 3600;

const NUMBERS = { max: MAX_LISTING_PHOTOS, seconds: MAX_VIDEO_DURATION_S, photos: MAX_SHOP_PHOTOS };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "guides.sell" });
  const alternates = localizedAlternates(locale, "/how-to-sell");
  const title = t("metaTitle");
  const description = t("metaDescription", NUMBERS);
  return {
    title,
    description,
    alternates,
    openGraph: { title, description, url: alternates.canonical as string, type: "article" },
  };
}

export default async function HowToSellPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const s = (key: string) => `guides.sell.steps.${key}`;

  const steps = [
    { key: "account", icon: UserPlus },
    { key: "photos", icon: Camera },
    { key: "video", icon: Video },
    { key: "details", icon: FileText },
    { key: "price", icon: Tag },
    { key: "location", icon: MapPin },
    { key: "publish", icon: Rocket },
    { key: "chat", icon: MessageCircle },
    { key: "meet", icon: Handshake },
    { key: "sold", icon: CheckCircle2 },
  ].map(({ key, icon }) => ({
    icon,
    title: t(`${s(key)}.title`),
    body: t(`${s(key)}.body`, NUMBERS),
  }));

  return (
    <GuidePage
      testId="guide-how-to-sell"
      title={t("guides.sell.title")}
      intro={t("guides.sell.intro")}
      cta={{ href: "/listings/new", label: t("guides.sell.startCta") }}
      relatedTitle={t("guides.relatedTitle")}
      related={[
        { href: "/buy-safely", label: t("guides.buy.title") },
        { href: "/prohibited-items", label: t("footer.prohibitedItems") },
        { href: "/download", label: t("nav.getApp") },
        ...CITY_SLUGS.map((slug) => ({
          href: `/cities/${slug}`,
          label: t("cities.title", { city: t(`cities.names.${slug}`) }),
        })),
      ]}
    >
      <GuideSection title={t("guides.sell.stepsTitle")}>
        <GuideSteps steps={steps} />
      </GuideSection>
      <GuideSection title={t("guides.sell.shopTitle")} id="shops">
        <p>{t("guides.sell.shopBody", NUMBERS)}</p>
      </GuideSection>
      <GuideSection title={t("guides.sell.verifiedTitle")} id="verified">
        <p className="flex gap-2">
          <BadgeCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <span>{t("guides.sell.verifiedBody")}</span>
        </p>
      </GuideSection>
      <GuideSection title={t("guides.sell.rulesTitle")} id="rules">
        <p>{t("guides.sell.rulesBody")}</p>
        <Link href="/prohibited-items" className="inline-flex min-h-11 items-center font-medium text-primary underline">
          {t("guides.sell.rulesLink")}
        </Link>
      </GuideSection>
    </GuidePage>
  );
}
