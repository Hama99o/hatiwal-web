"use client";

import { useEffect, useState } from "react";
import { useIsFetching, useQueryClient, type Query } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, History, LifeBuoy, Loader2, Lock, LogOut, Pencil, Settings, type LucideIcon } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { openSupportConversation } from "@/lib/api/chat";
import { describeApiError } from "@/lib/api/error-codes";
import { useSellingIdentity } from "@/components/shops/use-selling-identity";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { ConfirmEmailBanner } from "@/components/account/confirm-email-banner";
import { UserIdentity } from "@/components/shared/user-identity";
import { RatingDisplay } from "@/components/shared/rating-display";
import { AwayBanner } from "@/components/shared/away-banner";
import { Button } from "@/components/ui/button";
import { RestoreAccountBanner } from "./delete-account-section";
import { WarningsBanner } from "./warnings-banner";
import { PendingReviewsNudge } from "./pending-reviews-nudge";
import { VerificationCard } from "@/components/verify/verification-card";
import { ShopEntryCard } from "@/components/shops/shop-entry-card";
import { ShopInvitationsSection } from "@/components/shops/shop-invitations";
import { ModeToggle } from "./mode-toggle";
import { textDir } from "@/lib/text-direction";

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {/* User text (phone, bio, city): direction from its content. */}
      <span className="text-end" dir={textDir(value)}>{value}</span>
    </div>
  );
}

export function ProfileView() {
  const t = useTranslations();
  const { user, logout } = useAuth();
  const router = useRouter();
  const settled = useFirstLoadSettled();

  if (!user) return null;

  const name = user.fullName || `${user.firstname} ${user.lastname}`.trim();

  async function onLogout() {
    await logout();
    router.push("/");
  }

  return (
    <>
    {!settled && <ProfileSkeleton />}
    {/* Mounted (so its cards fetch) but hidden until their first loads are in:
        no card may push the page down after the first paint (owner, 2026-10-07,
        the same rule as mobile's Profile). */}
    <div className={settled ? "mx-auto max-w-2xl space-y-6 px-4 py-8" : "hidden"} aria-hidden={!settled}>
      <WarningsBanner />
      <RestoreAccountBanner />
      {/* Unconfirmed email — informs and offers a resend, never blocks, matching the
          API where allow_unconfirmed_access_for is nil. Renders nothing once
          confirmed, and nothing at all on an API build that does not report it. */}
      <ConfirmEmailBanner email={user.email} confirmed={user.emailConfirmed} />
      <PendingReviewsNudge />
      {/* VER-1: Get verified / under review / verified / rejected / revoked. */}
      <VerificationCard />
      {/* SHOP-1: "Open your shop" / "My shop · name · Open now". Buyer mode is
          personal (owner, 2026-10-05): shop tools only in Seller mode. */}
      {/* Owner, 1.1.6: pending invitations to join a shop, in BOTH modes, above My shops. */}
      <ShopInvitationsSection />
      {user.sellerMode && <ShopEntryCard />}
      <AwayBanner awayUntil={user.awayUntil} messageKey="profile.away.youAreAway" />
      <div className="flex items-start justify-between gap-4">
        <UserIdentity
          className="min-w-0"
          name={name}
          avatarUrl={user.avatarUrl}
          verified={user.verified}
          subtitle={user.city ?? user.email}
          size={64}
          nameAs="h1"
          /* Your own reputation — the number buyers judge you by — sits in the
             identity's text column, under your name, so it reads as *yours*.
             Default (sm) size on purpose: your name stays the loudest thing on
             your own profile. Falls back to a neutral "No reviews yet" for a
             brand-new account, and jumps to the list (mobile taps through). */
          meta={
            <Link
              href="/profile/activity#my-reviews"
              /* min-h-10 + padding: the rating text alone is only ~20px tall,
                 well under a thumb-sized target. Negative margins keep the
                 enlarged box optically aligned with the name above it. */
              className="-mx-2 -my-1.5 inline-flex min-h-10 items-center rounded-md px-2 py-1.5 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <RatingDisplay
                avgRating={user.avgRating}
                reviewCount={user.reviewCount}
              />
              {/* No aria-label on the link: it would replace the score and
                  count with the destination. This adds the destination *after*
                  them instead, so a screen reader announces all three. */}
              <span className="sr-only">{t("reviews.myReviewsTitle")}</span>
            </Link>
          }
        />
        {/* Owner, 2026-10-08: a plain pencil by the photo (no text, no border),
            like mobile; Settings keeps its own Edit. */}
        <Button asChild variant="ghost" size="icon" className="size-10 shrink-0 text-muted-foreground">
          <Link href="/profile/edit" aria-label={t("profile.editProfile")} title={t("profile.editProfile")}>
            <Pencil className="size-5" />
          </Link>
        </Button>
      </div>

      <ModeToggle className="w-full" />

      <ProfileHubNav />

      {/* Log out ALONE at the bottom, after a clear gap (owner, 2026-10-08:
          Delete account no longer sits next to it — it is on Privacy & account). */}
      <Button
        variant="ghost"
        className="mt-6 w-full text-muted-foreground"
        onClick={onLogout}
        data-testid="sign-out-button"
      >
        <LogOut className="size-4" />
        {t("profile.logout")}
      </Button>

    </div>
    </>
  );
}

/** One navigation row of the Profile's grouped lists: icon, label, chevron. */
export function ProfileRowLink({ href, Icon, label, id }: { href: string; Icon: LucideIcon; label: string; id: string }) {
  return (
    <Link
      href={href}
      data-testid={`profile-row-${id}`}
      className="flex min-h-12 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground rtl:-scale-x-100" aria-hidden />
    </Link>
  );
}

/**
 * The hub (owner, 2026-10-08, approved structure; mobile docs/design/
 * PROFILE_HUB.md): under the cards, FOUR rows — Activity, Help & support,
 * Privacy & account (Delete account inside), Settings — then Log out alone.
 */
function ProfileHubNav() {
  const t = useTranslations();
  return (
    <nav aria-label={t("profile.title")} className="divide-y overflow-hidden rounded-lg border bg-card" data-testid="profile-hub">
      <ProfileRowLink href="/profile/activity" Icon={History} label={t("profile.hub.activity")} id="activity" />
      <ProfileRowLink href="/profile/help" Icon={LifeBuoy} label={t("profile.hub.help")} id="help" />
      <ProfileRowLink href="/profile/privacy-account" Icon={Lock} label={t("profile.hub.privacyAccount")} id="privacy-account" />
      <ProfileRowLink href="/profile/settings" Icon={Settings} label={t("profile.hub.settings")} id="settings" />
    </nav>
  );
}

/**
 * Owner, 2026-10-08: Profile → "Contact support", in both modes, like mobile.
 * Opens THIS identity's Support thread directly (the person's own; selling as
 * a shop, that shop's), even when it was archived: the API revives it. A
 * failure says so, with Retry, instead of a dead click.
 */
export function ContactSupportRow() {
  const t = useTranslations();
  const router = useRouter();
  const { user } = useAuth();
  const { sellingAs } = useSellingIdentity();
  const shopId = user?.sellerMode ? sellingAs?.id : undefined;
  const open = useMutation({
    mutationFn: () => openSupportConversation(shopId),
    onSuccess: (c) => router.push(`/conversations/${c.id}`),
    onError: (err) =>
      toast.error(describeApiError(err, t, { fallbackKey: "chat.support.openError" }), {
        action: { label: t("common.retry"), onClick: () => open.mutate() },
      }),
  });
  return (
    <button
      type="button"
      onClick={() => !open.isPending && open.mutate()}
      disabled={open.isPending}
      data-testid="profile-row-contact-support"
      className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none disabled:opacity-70"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <LifeBuoy className="size-4" />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{t("profile.quickActions.contactSupport")}</span>
      {open.isPending ? (
        <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
      ) : (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground rtl:-scale-x-100" aria-hidden />
      )}
    </button>
  );
}

/** The queries behind the Profile's cards that would otherwise arrive late. */
const PROFILE_FIRST_LOADS = new Set(["warnings", "pending-reviews", "verification-status", "my-shop-invites", "seller-analytics"]);
const firstLoad = (q: Query) => PROFILE_FIRST_LOADS.has(String(q.queryKey[0])) && q.state.data === undefined;

/**
 * True once none of the cards' FIRST loads is in flight (latched: a later
 * refetch never brings the skeleton back). Checked live after the children's
 * effects have started their fetches; already-cached data settles at once.
 * Capped at 8 s so a hung request can never hide the page.
 */
function useFirstLoadSettled(): boolean {
  const qc = useQueryClient();
  const fetching = useIsFetching({ predicate: firstLoad });
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (settled) return;
    if (qc.isFetching({ predicate: firstLoad }) === 0) setSettled(true);
  }, [fetching, settled, qc]);
  useEffect(() => {
    const cap = setTimeout(() => setSettled(true), 8000);
    return () => clearTimeout(cap);
  }, []);
  return settled;
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8" data-testid="profile-skeleton" aria-busy="true">
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <Skeleton className="h-12 w-full rounded-full" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-56 w-full rounded-xl" />
    </div>
  );
}
