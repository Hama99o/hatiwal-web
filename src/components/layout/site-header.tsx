import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { LocaleSwitcher } from "./locale-switcher";
import { HeaderSearch } from "./header-search";
import { AuthNav } from "./auth-nav";

export function SiteHeader() {
  const t = useTranslations("nav");

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
        <Link href="/" aria-label="Hatiwal home">
          <Logo />
        </Link>

        <HeaderSearch className="hidden max-w-md flex-1 md:block" />

        <nav className="ms-auto flex items-center gap-1">
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link href="/browse">{t("browse")}</Link>
          </Button>
          <Button asChild variant="ghost" className="hidden lg:inline-flex">
            <Link href="/categories">{t("categories")}</Link>
          </Button>
          <ThemeToggle />
          <LocaleSwitcher />
          <AuthNav />
        </nav>
      </div>

      {/* Search drops below the bar on small screens. */}
      <div className="px-4 pb-3 md:hidden">
        <HeaderSearch />
      </div>
    </header>
  );
}
