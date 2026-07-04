import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Rubik, Zain, Noto_Sans_Arabic } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, dir } from "@/i18n/routing";
import { SITE_URL } from "@/lib/env";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import "../globals.css";

// Brand fonts. Rubik (Latin + Arabic) is the primary; Zain adds the Arabic
// display character; Noto Sans Arabic is the guaranteed Pashto/Dari cover for
// the extended letters (ټ ډ ړ ږ ښ ګ ڼ ې) that Rubik/Zain may lack. Browsers do
// per-glyph fallback across the stack, so en/ps/fa all render correctly.
const rubik = Rubik({
  subsets: ["latin", "arabic"],
  variable: "--font-rubik",
  display: "swap",
});
const zain = Zain({
  subsets: ["latin", "arabic"],
  weight: ["400", "700"],
  variable: "--font-zain",
  display: "swap",
});
const notoArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-noto-arabic",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// Browser chrome / address-bar color, matched to the page background per scheme.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1020" },
  ],
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: "Hatiwal", template: "%s — Hatiwal" },
    description: t("hero.subtitle"),
    openGraph: {
      siteName: "Hatiwal",
      type: "website",
      title: "Hatiwal",
      description: t("hero.subtitle"),
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      dir={dir(locale)}
      className={`${rubik.variable} ${zain.variable} ${notoArabic.variable}`}
      suppressHydrationWarning
    >
      {/* suppressHydrationWarning: browser extensions (e.g. Grammarly) inject
          attributes like data-gr-ext-installed onto <body> after SSR, which
          would otherwise trip a hydration warning. next-themes also sets the
          class/style on the html element pre-hydration. */}
      <body
        className="flex min-h-screen flex-col antialiased"
        suppressHydrationWarning
      >
        <NextIntlClientProvider>
          <Providers>
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
