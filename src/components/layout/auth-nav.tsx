"use client";

import { useTranslations } from "next-intl";
import { Heart, LogOut, Plus, Tag, User as UserIcon } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { UserAvatar } from "@/components/shared/user-avatar";
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

  return (
    <>
      <Button asChild size="sm" className="hidden sm:inline-flex">
        <Link href="/listings/new">
          <Plus className="size-4" />
          {t("listing.postListing")}
        </Link>
      </Button>
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
              {t("profile.title")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/my-listings">
              <Tag className="size-4" />
              {t("profile.quickActions.myListings")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/saved">
              <Heart className="size-4" />
              {t("saved.title")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="sm:hidden">
            <Link href="/listings/new">
              <Plus className="size-4" />
              {t("listing.postListing")}
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
