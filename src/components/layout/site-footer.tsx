import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Logo } from "./logo";

export function SiteFooter() {
  const t = useTranslations();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t bg-card">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xs space-y-3">
          <Logo />
          <p className="text-sm text-muted-foreground">
            {t("footer.tagline")}
          </p>
        </div>
        <nav className="flex flex-col gap-2 text-sm">
          <span className="font-semibold text-foreground">
            {t("footer.explore")}
          </span>
          <Link
            href="/browse"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("nav.browse")}
          </Link>
          <Link
            href="/categories"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("nav.categories")}
          </Link>
        </nav>
      </div>
      <div className="border-t py-4 text-center text-xs text-muted-foreground">
        {t("footer.rights", { year })}
      </div>
    </footer>
  );
}
