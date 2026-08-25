"use client";

import { useLocale, useTranslations } from "next-intl";
import { Eye, LogOut, Pencil } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import { useAuth } from "@/components/auth/auth-provider";
import { ConfirmEmailBanner } from "@/components/account/confirm-email-banner";
import { UserIdentity } from "@/components/shared/user-identity";
import { RatingDisplay } from "@/components/shared/rating-display";
import { ReviewsSection } from "@/components/seller/reviews-section";
import { AwayBanner } from "@/components/shared/away-banner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DeleteAccountButton,
  RestoreAccountBanner,
} from "./delete-account-section";
import { WarningsBanner } from "./warnings-banner";
import { PendingReviewsNudge } from "./pending-reviews-nudge";
import { ModeToggle } from "./mode-toggle";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-end">{value}</span>
    </div>
  );
}

export function ProfileView() {
  const t = useTranslations();
  const locale = useLocale();
  const { user, logout } = useAuth();
  const router = useRouter();

  if (!user) return null;

  const name = user.fullName || `${user.firstname} ${user.lastname}`.trim();
  const none = t("profile.noInfo");
  const stats = [
    { label: t("profile.stats.active"), value: user.itemsActiveCount ?? 0 },
    { label: t("profile.stats.sold"), value: user.itemsSoldCount ?? 0 },
    { label: t("profile.itemsSaved"), value: user.savedItemsCount ?? 0 },
  ];

  async function onLogout() {
    await logout();
    router.push("/");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <WarningsBanner />
      <RestoreAccountBanner />
      {/* Unconfirmed email — informs and offers a resend, never blocks, matching the
          API where allow_unconfirmed_access_for is nil. Renders nothing once
          confirmed, and nothing at all on an API build that does not report it. */}
      <ConfirmEmailBanner email={user.email} confirmed={user.emailConfirmed} />
      <PendingReviewsNudge />
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
            <a
              href="#my-reviews"
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
            </a>
          }
        />
        <Button asChild variant="outline" size="sm">
          <Link href="/profile/edit">
            <Pencil className="size-4" />
            {t("profile.editProfile")}
          </Link>
        </Button>
      </div>

      <ModeToggle className="w-full" />

      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border bg-card p-4 text-center">
            {/* `formatNumber`, not `{s.value}`: these printed raw, so on /ps and
                /fa three Latin tile numbers sat under an Arabic-Indic review
                count on the same screen (see `e2e/i18n-digits.spec.ts`). */}
            <div className="text-xl font-bold" data-testid="profile-stat-value">
              {formatNumber(s.value, locale)}
            </div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">{t("profile.info")}</h2>
        <Separator />
        <InfoRow label={t("profile.edit.fields.phone")} value={user.phone || none} />
        <InfoRow label={t("profile.edit.fields.bio")} value={user.bio || none} />
        <InfoRow label={t("profile.edit.fields.city")} value={user.city || none} />
        <InfoRow
          label={t("profile.edit.fields.province")}
          value={user.province || none}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* /sellers/[id] is the canonical public profile (/users/[id] redirects
            to it) — lets you see exactly what buyers see. Hidden while the
            account is scheduled for deletion: Rails scopes the public profile
            to `User.publicly_active`, so the page would 404. The restore banner
            at the top already explains that state. */}
        {!user.deletionScheduledAt && (
          <Button asChild variant="secondary" className="col-span-2">
            <Link href={`/sellers/${user.id}`}>
              <Eye className="size-4" />
              {t("profile.viewPublicProfile")}
            </Link>
          </Button>
        )}
        <Button asChild variant="secondary">
          <Link href="/saved">{t("saved.title")}</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/recently-viewed">{t("recentlyViewed.title")}</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/settings/hidden-listings">{t("hidden.title")}</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/bazaar">{t("profile.quickActions.browse")}</Link>
        </Button>
      </div>

      {/* The reviews buyers left about you — same component (role tabs, load
          more, skeleton, empty state) as the public seller profile, only the
          heading differs. `getUserReviews` is public (plain `User.find`, no
          publicly_active gate), so your own id always works. The score isn't
          repeated here; it sits under your name above.
          tabIndex={-1}: browsers only move focus to an in-page anchor target
          when it is focusable, so without it the rating link scrolls but leaves
          a keyboard user's focus stranded at the top of the page. */}
      <div id="my-reviews" tabIndex={-1} className="scroll-mt-24 focus:outline-none">
        <ReviewsSection
          sellerId={user.id}
          title={t("reviews.myReviewsTitle")}
          headingSize="sm"
        />
      </div>

      <Button
        variant="ghost"
        className="w-full text-destructive hover:text-destructive"
        onClick={onLogout}
      >
        <LogOut className="size-4" />
        {t("profile.logout")}
      </Button>

      <Separator />
      <DeleteAccountButton />
    </div>
  );
}
