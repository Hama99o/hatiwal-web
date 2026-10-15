import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Logo } from "./logo";

// 32px rows with a mouse, 44px on a touch screen (#22: these were 20px tall).
const LINK =
  "inline-flex min-h-8 items-center rounded-sm text-sm text-foreground/75 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11";
const HEADING = "mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground";

/**
 * Site footer (visual-system.md §4): a `--surface` band, not a bordered card —
 * Airbnb / Klarna. Each link group is a `<nav>` NAMED by its visible heading
 * (`aria-labelledby`), so the header's and the footer's navigation landmarks are
 * distinguishable (axe `landmark-unique`, report #23). The labels are <p>, not
 * headings: a footer column is not a section of the page's outline.
 */
export function SiteFooter() {
  const t = useTranslations();
  const year = new Date().getFullYear();

  return (
    <footer data-site-footer className="mt-16 bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-8 pt-12 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="max-w-xs space-y-3">
          <Logo />
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("footer.tagline")}
          </p>
        </div>
        <nav aria-labelledby="footer-explore" className="flex flex-col items-start gap-1">
          <p id="footer-explore" className={HEADING}>
            {t("footer.explore")}
          </p>
          <Link href="/bazaar" className={LINK}>
            {t("nav.browse")}
          </Link>
          <Link href="/categories" className={LINK}>
            {t("nav.categories")}
          </Link>
          <Link href="/download" className={LINK}>
            {t("nav.getApp")}
          </Link>
        </nav>
        <nav aria-labelledby="footer-legal" className="flex flex-col items-start gap-1">
          <p id="footer-legal" className={HEADING}>
            {t("footer.legal")}
          </p>
          <Link href="/privacy" className={LINK}>
            {t("footer.privacy")}
          </Link>
          <Link href="/prohibited-items" className={LINK}>
            {t("footer.prohibitedItems")}
          </Link>
          <Link href="/delete-account" className={LINK}>
            {t("footer.deleteAccount")}
          </Link>
        </nav>
      </div>
      <div className="mx-auto max-w-7xl px-4">
        <div className="border-t py-5 text-xs text-muted-foreground">
          {t("footer.rights", { year })}
        </div>
      </div>
    </footer>
  );
}
