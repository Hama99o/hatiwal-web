"use client";

import { useTranslations } from "next-intl";
import { Plus, Store, Tag } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HeaderSearch } from "./header-search";

/**
 * Mode-aware header navigation (mobile parity, docs/design/mode-switch.md).
 * Mobile swaps its whole tab bar by mode: Buyer = Bazaar · Categories · Saved ·
 * Chats · Me, Seller = My listings (or My shop) · Chats · Me. The web header does
 * the same — buying links in Buyer mode, selling links in Seller mode, never both.
 */
function useSellerMode() {
  const { user, status } = useAuth();
  return { seller: status === "authed" && !!user?.sellerMode, user };
}

/** Desktop links (sm+), beside the theme / language / chat / avatar controls. */
export function ModeLinks() {
  const t = useTranslations();
  const pathname = usePathname();
  const { seller, user } = useSellerMode();

  if (seller && user) {
    const shop = user.sellingAsShop ?? null;
    return (
      <>
        <Button
          asChild
          variant="ghost"
          className={cn("hidden sm:inline-flex", pathname.startsWith("/my-listings") && "text-seller")}
        >
          <Link href="/my-listings" data-testid="nav-my-listings">
            <Tag className="size-4" aria-hidden />
            {/* SHOP-1: "My listings" as Me, "My shop" when selling as a shop. */}
            {shop ? t("shops.mine") : t("sidebar.myListings")}
          </Link>
        </Button>
        {shop && (
          <Button asChild variant="ghost" className="hidden lg:inline-flex">
            <Link href={`/shops/${shop.id}`} data-testid="nav-shop-page">
              <Store className="size-4" aria-hidden />
              <span className="max-w-40 truncate">{shop.name}</span>
            </Link>
          </Button>
        )}
        <Button asChild className="hidden sm:inline-flex">
          <Link href="/listings/new" data-testid="nav-new-listing">
            <Plus className="size-4" aria-hidden />
            {t("sidebar.createListing")}
          </Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <Button asChild variant="ghost" className="hidden sm:inline-flex">
        <Link href="/bazaar">{t("nav.browse")}</Link>
      </Button>
      <Button asChild variant="ghost" className="hidden lg:inline-flex">
        <Link href="/categories">{t("nav.categories")}</Link>
      </Button>
    </>
  );
}

/**
 * The header's second row on phones (below md). Buyer / guest: the search field.
 * Seller: the selling shortcuts instead — mobile hides the Bazaar in Seller mode,
 * and these links are otherwise only in the account menu on a phone. The "Selling
 * as" switcher is NOT repeated here: My listings and Chats carry their own pill
 * (where mobile has it) and the account menu has the list on every page.
 */
export function ModeSubRow() {
  const t = useTranslations();
  const { seller, user } = useSellerMode();

  if (!seller || !user) {
    return (
      <div className="px-4 pb-3 md:hidden">
        <HeaderSearch />
      </div>
    );
  }
  return (
    <div
      className="flex items-center gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] md:hidden"
      data-testid="seller-subnav"
    >
      <Button asChild variant="outline" size="sm" className="h-10 shrink-0">
        <Link href="/my-listings">
          <Tag className="size-4" aria-hidden />
          {user.sellingAsShop ? t("shops.mine") : t("sidebar.myListings")}
        </Link>
      </Button>
      <Button asChild size="sm" className="h-10 shrink-0">
        <Link href="/listings/new">
          <Plus className="size-4" aria-hidden />
          {t("sidebar.createListing")}
        </Link>
      </Button>
    </div>
  );
}

/** Mobile's seller accent: a thin emerald line on the header while selling. */
export function SellerModeBar() {
  const { seller } = useSellerMode();
  if (!seller) return null;
  return (
    <span
      aria-hidden
      data-testid="seller-mode-bar"
      className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-seller"
    />
  );
}
