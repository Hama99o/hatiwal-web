import type { Metadata } from "next";
import { MessageCircle, MapPin, Handshake } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localizedAlternates } from "@/lib/seo";
import { DownloadOptions } from "@/components/download/download-options";

// The one link in the TikTok bio (captions there are not clickable), so this
// page carries its OWN localized title + description instead of the site default.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "download" });
  return {
    // absolute: the layout's "%s — Hatiwal" template would append the Latin
    // brand to a Pashto/Dari/Urdu title that already carries its own.
    title: { absolute: t("metaTitle") },
    description: t("metaDescription"),
    alternates: localizedAlternates(locale, "/download"),
    openGraph: {
      title: t("metaTitle"),
      description: t("metaDescription"),
      url: `/${locale}/download`,
    },
  };
}

export default async function DownloadPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "download" });

  const steps = [
    { icon: MapPin, title: t("steps.find.title"), body: t("steps.find.body") },
    { icon: MessageCircle, title: t("steps.chat.title"), body: t("steps.chat.body") },
    { icon: Handshake, title: t("steps.meet.title"), body: t("steps.meet.body") },
  ];

  return (
    <div className="border-b bg-gradient-to-br from-primary/10 via-background to-background">
      <div className="mx-auto max-w-xl px-4 py-12 sm:py-16">
        <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-3 text-pretty text-lg text-muted-foreground">{t("subtitle")}</p>

        <DownloadOptions />

        <ol className="mt-10 space-y-4">
          {steps.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
