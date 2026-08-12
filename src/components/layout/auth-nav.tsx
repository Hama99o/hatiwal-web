"use client";

import { useTranslations } from "next-intl";
import {
  Flag,
  Heart,
  LogOut,
  MessageSquare,
  Plus,
  ShieldOff,
  Tag,
  User as UserIcon,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { UserAvatar } from "@/components/shared/user-avatar";
import { CountBadge } from "@/components/shared/count-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AuthNav() {
  const t = useTranslations();
  const { user, status, logout } = useAuth();
  const router = useRouter();

  if (status === "loading") {
    return <div className="size-9 animate-pulse rounded-full bg-muted" />;
  }

  if (status === "guest" || !user) {
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

  const unread = user.unreadMessageCount ?? 0;

  return (
    <>
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
          <CountBadge
            count={unread}
            className="absolute end-0.5 top-0.5 min-w-4 px-1 py-0 leading-4"
          />
        </Link>
      </Button>
      {user.sellerMode && (
        <>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
          >
            <Link href="/my-listings">
              <Tag className="size-4" />
              {t("sidebar.myListings")}
            </Link>
          </Button>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/listings/new">
              <Plus className="size-4" />
              {t("sidebar.createListing")}
            </Link>
          </Button>
        </>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label={name}
          >
            <UserAvatar name={name} avatarUrl={user.avatarUrl} size={36} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuLabel className="truncate">{name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/profile">
              <UserIcon className="size-4" />
              {t("sidebar.profile")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/my-listings">
              <Tag className="size-4" />
              {t("sidebar.myListings")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/conversations">
              <MessageSquare className="size-4" />
              {t("sidebar.chat")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/saved">
              <Heart className="size-4" />
              {t("sidebar.saved")}
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
          <DropdownMenuItem
            asChild
            className={user.sellerMode ? "sm:hidden" : undefined}
          >
            <Link href="/listings/new">
              <Plus className="size-4" />
              {t("sidebar.createListing")}
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
