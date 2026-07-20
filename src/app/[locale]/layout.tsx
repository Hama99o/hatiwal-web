import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, dir } from "@/i18n/routing";
import { SITE_URL } from "@/lib/env";
import { localizedAlternates } from "@/lib/seo";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import "../globals.css";

// Brand fonts — SELF-HOSTED (next/font/local) so there is NO build-time fetch to
// Google Fonts. That build-time fetch is unreliable in CI (it hangs the E2E dev
// server), and self-hosting is faster + privacy-friendly in production anyway.
// Rubik = Latin primary; Zain = Arabic display; Noto Sans Arabic = the guaranteed
// Pashto/Dari cover for extended letters (ټ ډ ړ ږ ښ ګ ڼ ې). Browsers fall back
// per-glyph across the stack, so en/ps/fa all render.
const rubik = localFont({
  src: [
    { path: "../fonts/Rubik_400Regular.ttf", weight: "400", style: "normal" },
    { path: "../fonts/Rubik_700Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-rubik",
  display: "swap",
});
const zain = localFont({
  src: [
    { path: "../fonts/Zain_400Regular.ttf", weight: "400", style: "normal" },
    { path: "../fonts/Zain_700Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-zain",
  display: "swap",
});
const notoArabic = localFont({
  src: [
    { path: "../fonts/NotoSansArabic_400Regular.ttf", weight: "400", style: "normal" },
    { path: "../fonts/NotoSansArabic_700Bold.ttf", weight: "700", style: "normal" },
  ],
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
    // Canonical + hreflang for the home page. Pages with their own
    // generateMetadata set their own alternates (they'd otherwise inherit these).
    alternates: localizedAlternates(locale, "/"),
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
