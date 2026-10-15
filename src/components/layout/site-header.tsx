import { Link } from "@/i18n/navigation";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { LocaleSwitcher } from "./locale-switcher";
import { HeaderSearch } from "./header-search";
import { AuthNav } from "./auth-nav";
import { ModeLinks, ModeSubRow, SellerModeBar } from "./mode-nav";
import { AppPromptHeaderButton } from "@/components/shared/app-prompt";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <SellerModeBar />
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
        <Link href="/" aria-label="Hatiwal home">
          <Logo />
        </Link>

        <HeaderSearch className="hidden max-w-md flex-1 md:block" />

        <nav className="ms-auto flex items-center gap-1">
          {/* Buying links in Buyer mode, selling links in Seller mode (mode-nav.tsx). */}
          <ModeLinks />
          {/* Phones only, once the install suggestion was closed. */}
          <AppPromptHeaderButton />
          <ThemeToggle />
          <LocaleSwitcher />
          <AuthNav />
        </nav>
      </div>

      {/* Phones: the search row (Buyer / guest) or the selling shortcuts (Seller). */}
      <ModeSubRow />
    </header>
  );
}
