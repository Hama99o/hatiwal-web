import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localizedAlternates } from "@/lib/seo";
import { SUPPORT_EMAIL } from "@/lib/app-links";

// Public list of what can't be sold on Hatiwal (owner, 2026-10-13). The API's
// Support message to a seller whose listing was taken down links here:
// https://hatiwal.com/<locale>/prohibited-items. Keep it in step with the
// categories in hatiwal-api config/prohibited_terms.yml.
export const revalidate = 60;

const CATEGORIES = [
  "firearms",
  "ammunition",
  "explosives",
  "drugs",
  "alcohol",
  "fakeDocuments",
  "stolenGoods",
  "adult",
  "gambling",
  "trafficking",
  "medicine",
] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "prohibitedItems" });
  return {
    title: t("title"),
    description: t("intro"),
    alternates: localizedAlternates(locale, "/prohibited-items"),
  };
}

export default async function ProhibitedItemsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "prohibitedItems" });

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t("title")}</h1>
      <p className="mt-4 text-muted-foreground">{t("intro")}</p>

      <div className="mt-8 space-y-6" data-testid="prohibited-categories">
        {CATEGORIES.map((key) => (
          <section key={key} id={key}>
            <h2 className="text-lg font-semibold">{t(`${key}Title`)}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t(`${key}Body`)}</p>
          </section>
        ))}
      </div>

      <section className="mt-8 rounded-md border bg-success/10 px-4 py-3" data-testid="prohibited-allowed">
        <h2 className="text-lg font-semibold">{t("allowedTitle")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("allowedBody")}</p>
      </section>

      <div className="mt-8 space-y-6">
        <section>
          <h2 className="text-lg font-semibold">{t("whatHappensTitle")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("whatHappensBody")}</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">{t("reportTitle")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("reportBody", { email: SUPPORT_EMAIL })}</p>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-2 inline-block font-medium text-primary underline">
            {SUPPORT_EMAIL}
          </a>
        </section>
      </div>
    </div>
  );
}
