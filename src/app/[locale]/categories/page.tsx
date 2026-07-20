import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCategories, categoryName } from "@/lib/api/categories";
import { localizedAlternates } from "@/lib/seo";
import { safe } from "@/lib/api/safe";

export const revalidate = 600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "categoriesPage" });
  return {
    title: t("title"),
    alternates: localizedAlternates(locale, "/categories"),
  };
}

export default async function CategoriesIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const categories = await safe(getCategories({ revalidate: 600 }), []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t("categoriesPage.title")}</h1>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/categories/${category.slug}`}
            className="flex flex-col items-center gap-2 rounded-lg border bg-card p-6 text-center transition-shadow hover:shadow-md"
          >
            <span className="text-3xl" aria-hidden>
              {category.icon ?? "📦"}
            </span>
            <span className="text-sm font-medium">
              {categoryName(category, locale)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
