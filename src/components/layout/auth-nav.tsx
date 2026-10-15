"use client";

import { useTranslations } from "next-intl";
import {
  Check,
  Flag,
  Heart,
  LogOut,
  MessageSquare,
  Plus,
  ShieldOff,
  ShoppingBag,
  Store,
  Tag,
  User as UserIcon,
  Users,
} from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { UserAvatar } from "@/components/shared/user-avatar";
import { CountBadge } from "@/components/shared/count-badge";
import { Button } from "@/components/ui/button";
import { DroppedToMeNotice } from "@/components/shops/dropped-to-me-notice";
import { useSellingIdentity } from "@/components/shops/use-selling-identity";
import { useModeSwitch } from "@/components/account/use-mode-switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IdentityName } from "@/components/shops/identity-name";

export function AuthNav() {
  const t = useTranslations();
  const { user, status, logout } = useAuth();
  // SHOP-1: "My listings" as Me, "My shop" when selling as a shop.
  const myListingsLabel = user?.sellingAsShop ? t("shops.mine") : t("sidebar.myListings");
  const router = useRouter();
  const pathname = usePathname();
  const mode = useModeSwitch();
  const identity = useSellingIdentity();

  if (status === "loading") {
    return <div className="size-9 animate-pulse rounded-full bg-muted" />;
  }

  if (status === "guest" || !user) {
    // On the sign-in / sign-up pages themselves the header "Login" only repeated
    // the form's own button (and each page links to the other).
    if (pathname === "/login" || pathname === "/signup") return null;
    return (
      <Button asChild variant="default" size="sm">
        <Link href="/login">{t("auth.login")}</Link>
      </Button>
    );
  }

  const name = user.fullName || `${user.firstname} ${user.lastname}`.trim();

  async function onLogout() {
    await logout();
    router.push("/");
  }

  // SHOP-1, as mobile's tab badge (app/(main)/(tabs)/_layout.tsx): with a shop the
  // badge is THIS identity's inbox — Buyer mode = buying only, Seller = Me or the
  // current shop (their Support included, via the API's split). Without a shop or
  // without the split it is the total, exactly as before.
  const splitUnread = identity.hasShop
    ? user.sellerMode
      ? identity.unreadFor(identity.sellingAs?.id ?? null)
      : identity.unreadBuying
    : null;
  const unread = splitUnread ?? user.unreadMessageCount ?? 0;

  return (
    <>
      {/* SHOP-1: "You were removed from …" once, if the server drops you to Me. */}
      <DroppedToMeNotice />
      {mode.dialog}
      <Button
        asChild
        variant="ghost"
        size="icon"
        className="relative"
        // The COUNT has to ride in the aria-label itself: an aria-label replaces
        // the name computed from the contents, so the `aria-hidden` pill — and any
        // sr-only sibling a child might render — is dropped. Without this a screen
        // reader user heard "Chat" whether nine buyers were waiting or none, while
        // sighted users got the badge. Same pluralized key the thread list uses.
        aria-label={
          unread > 0 ? t("chat.unreadCount", { count: unread }) : t("sidebar.chat")
        }
      >
        <Link href="/conversations">
          <MessageSquare className="size-5" />
          {/* The shared count pill — same primitive, same AA-safe fill AND the
              same digits as every other count in the app. This used to print
              `unread > 9 ? "9+" : unread` raw, so on /ps and /fa the header
              showed a Latin "2" beside Arabic-Indic digits everywhere else.
              No `label`: an sr-only sibling could never win against the
              aria-label above, which carries the number instead. */}
          {/* On the icon's top END corner, growing outward so the digits
              never cover the glyph (owner, 2026-10-08); `start-1/2` mirrors in RTL. */}
          <CountBadge
            count={unread}
            className="absolute -top-1 start-1/2 py-0 ring-2 ring-background"
          />
        </Link>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            // A 36px avatar in a 40 / 44px (touch) hit area (#22).
            className="flex size-10 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background pointer-coarse:size-11"
            aria-label={name}
          >
            <span className="relative block">
              <UserAvatar name={name} avatarUrl={user.avatarUrl} avatarFallbackUrl={user.avatarOriginalUrl} size={36} />
              {/* Owner, 1.1.6: a pending invitation to join a shop. */}
              {(user.pendingShopInvitesCount ?? 0) > 0 && (
                <span
                  data-testid="profile-invites-dot"
                  aria-label={t("shops.invitations.title")}
                  className="absolute -end-0.5 -top-0.5 size-3 rounded-full border-2 border-background bg-destructive"
                />
              )}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuLabel className="truncate">{name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {/* Buying / Selling — the same switch as Profile (useModeSwitch), here
              so it is one tap from anywhere, like Airbnb's "Switch to hosting". */}
          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
            {t("profile.modeToggleLabel")}
          </DropdownMenuLabel>
          {(["buyer", "seller"] as const).map((m) => {
            const active = (m === "seller") === user.sellerMode;
            return (
              <DropdownMenuItem
                key={m}
                disabled={mode.busy}
                onSelect={() => mode.select(m)}
                data-testid={`menu-mode-${m}`}
                aria-current={active ? "true" : undefined}
                className={active ? "font-semibold" : undefined}
              >
                {m === "buyer" ? (
                  <ShoppingBag className="size-4" />
                ) : (
                  <Store className={active ? "size-4 text-seller" : "size-4"} />
                )}
                {t(m === "buyer" ? "profile.buyerMode" : "profile.sellerMode")}
                {active && <Check className="ms-auto size-4" aria-hidden />}
              </DropdownMenuItem>
            );
          })}
          {/* SHOP-1 "Sell as" — Seller mode only (Buyer mode is always personal,
              owner 2026-10-05) and only with an active shop. The server decides
              (PATCH users/me/selling_as checks membership); a refused switch says
              so and refreshes `me`. */}
          {user.sellerMode && identity.hasShop && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                {t("shops.sellAs")}
              </DropdownMenuLabel>
              {[{ id: null as number | null, name, prefix: t("shops.me") as string | undefined, role: null as string | null },
                ...identity.shops.map((sh) => ({ id: sh.id as number | null, name: sh.name, prefix: undefined, role: sh.role as string | null }))].map((o) => {
                const active = (identity.sellingAs?.id ?? null) === o.id;
                return (
                  <DropdownMenuItem
                    key={String(o.id)}
                    disabled={identity.switching}
                    onSelect={() => identity.switchTo(o.id)}
                    data-testid={o.id === null ? "menu-sell-as-me" : `menu-sell-as-shop-${o.id}`}
                    aria-current={active ? "true" : undefined}
                  >
                    {o.id === null ? <UserIcon className="size-4" /> : <Store className="size-4" />}
                    <IdentityName name={o.name} prefix={o.prefix} />
                    {o.role && (
                      <span className="text-xs text-muted-foreground">
                        {t(`shops.roles.${o.role}`)}
                      </span>
                    )}
                    {active && <Check className="size-4" aria-hidden />}
                  </DropdownMenuItem>
                );
              })}
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/profile">
              <UserIcon className="size-4" />
              {t("sidebar.profile")}
            </Link>
          </DropdownMenuItem>
          {user.sellerMode ? (
            <>
              <DropdownMenuItem asChild>
                <Link href="/my-listings">
                  <Tag className="size-4" />
                  {myListingsLabel}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/listings/new">
                  <Plus className="size-4" />
                  {t("sidebar.createListing")}
                </Link>
              </DropdownMenuItem>
              {/* Every member may see the team (ShopPolicy#team?). */}
              {identity.sellingAs && (
                <DropdownMenuItem asChild>
                  <Link href={`/shops/${identity.sellingAs.id}/team`}>
                    <Users className="size-4" />
                    {t("shops.team.title")}
                  </Link>
                </DropdownMenuItem>
              )}
            </>
          ) : (
            <DropdownMenuItem asChild>
              <Link href="/saved">
                <Heart className="size-4" />
                {t("sidebar.saved")}
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link href="/conversations">
              <MessageSquare className="size-4" />
              {t("sidebar.chat")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings/blocked-users">
              <ShieldOff className="size-4" />
              {t("profile.blockedUsers")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings/reports">
              <Flag className="size-4" />
              {t("report.myReports.title")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onLogout}
            className="text-destructive focus:text-destructive"
          >
            <LogOut className="size-4" />
            {t("profile.logout")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
