"use client";

/**
 * The four pages behind the Profile hub rows (owner, 2026-10-08, approved
 * structure, same as mobile — hatiwal-mobile docs/design/PROFILE_HUB.md):
 * Activity, Help & support, Privacy & account, Settings. Built from the
 * Profile's own pieces so rows look the same and keep their testIDs.
 */
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Eye, EyeOff, FileText, Flag, Heart, History, ShieldOff, ShoppingBag } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import { useAuth } from "@/components/auth/auth-provider";
import { ReviewsSection } from "@/components/seller/reviews-section";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { SellerNumbersCard } from "./seller-numbers-card";
import { DeleteAccountButton } from "./delete-account-section";
import { ContactSupportRow, InfoRow, ProfileRowLink } from "./profile-view";

function PageShell({ title, testId, children }: { title: string; testId: string; children: React.ReactNode }) {
  const t = useTranslations();
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8" data-testid={testId}>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label={t("common.back")}>
          <Link href="/profile">
            <ArrowLeft className="size-5 rtl:-scale-x-100" />
          </Link>
        </Button>
        <h1 className="text-xl font-bold">{title}</h1>
      </div>
      {children}
    </div>
  );
}

const listClass = "divide-y overflow-hidden rounded-lg border bg-card";

export function ProfileActivityView() {
  const t = useTranslations();
  const locale = useLocale();
  const { user } = useAuth();
  if (!user) return null;

  // Owner, 2026-10-07: no stats in Seller mode (it was unclear whether Sold /
  // Active were the person's or a shop's numbers). Buyer mode: Bought (when
  // any) + Saved, same as mobile.
  const bought = user.boughtCount ?? 0;
  const stats = user.sellerMode
    ? []
    : [
        ...(bought > 0 ? [{ label: t("profile.itemsBought"), value: bought }] : []),
        { label: t("profile.itemsSaved"), value: user.savedItemsCount ?? 0 },
      ];

  return (
    <PageShell title={t("profile.hub.activity")} testId="profile-activity-page">
      {/* Item 2 (owner, 2026-10-12): Seller mode's numbers, labelled with whose
          they are (Me / the shop sold as), opening /analytics. */}
      {user.sellerMode && <SellerNumbersCard />}

      {stats.length > 0 && (
        <div className={stats.length > 1 ? "grid grid-cols-2 gap-3" : "grid grid-cols-1 gap-3"}>
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border bg-card p-4 text-center">
              {/* `formatNumber`, not `{s.value}`: Arabic-Indic digits on /ps and /fa
                  (see `e2e/i18n-digits.spec.ts`). */}
              <div className="text-xl font-bold" data-testid="profile-stat-value">
                {formatNumber(s.value, locale)}
              </div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* /sellers/[id] is the canonical public profile; hidden while the account
          is scheduled for deletion (Rails scopes it to publicly_active → 404). */}
      <nav aria-label={t("profile.hub.activity")} className={listClass} data-testid="profile-shortcuts">
        {!user.deletionScheduledAt && (
          <ProfileRowLink href={`/sellers/${user.id}`} Icon={Eye} label={t("profile.viewPublicProfile")} id="public-profile" />
        )}
        <ProfileRowLink href="/saved" Icon={Heart} label={t("saved.title")} id="saved" />
        <ProfileRowLink href="/recently-viewed" Icon={History} label={t("recentlyViewed.title")} id="recently-viewed" />
        <ProfileRowLink href="/settings/hidden-listings" Icon={EyeOff} label={t("hidden.title")} id="hidden" />
        <ProfileRowLink href="/bazaar" Icon={ShoppingBag} label={t("profile.quickActions.browse")} id="browse" />
      </nav>

      {/* The reviews buyers left about you — same component as the public seller
          profile. tabIndex={-1} so the rating link's #my-reviews moves focus. */}
      <div id="my-reviews" tabIndex={-1} className="scroll-mt-24 focus:outline-none">
        <ReviewsSection sellerId={user.id} title={t("reviews.myReviewsTitle")} headingSize="sm" />
      </div>
    </PageShell>
  );
}

export function ProfileHelpView() {
  const t = useTranslations();
  return (
    <PageShell title={t("profile.hub.help")} testId="profile-help-page">
      <nav aria-label={t("profile.hub.help")} className={listClass}>
        <ContactSupportRow />
      </nav>
    </PageShell>
  );
}

export function ProfilePrivacyAccountView() {
  const t = useTranslations();
  return (
    <PageShell title={t("profile.hub.privacyAccount")} testId="profile-privacy-account-page">
      <nav aria-label={t("profile.hub.privacyAccount")} className={listClass}>
        <ProfileRowLink href="/settings/blocked-users" Icon={ShieldOff} label={t("profile.blockedUsers")} id="blocked-users" />
        <ProfileRowLink href="/settings/reports" Icon={Flag} label={t("report.myReports.title")} id="my-reports" />
        <ProfileRowLink href="/privacy" Icon={FileText} label={t("footer.privacy")} id="privacy-policy" />
      </nav>

      {/* Delete account: here, on its own after a clear gap — never next to Log
          out again (owner, 2026-10-08). The confirm dialog guards it. */}
      <div className="space-y-2 pt-4" data-testid="profile-delete-account">
        <div className="overflow-hidden rounded-lg border bg-card">
          <DeleteAccountButton />
        </div>
        <p className="px-1 text-xs text-muted-foreground">{t("profile.hub.deleteAccountHint")}</p>
      </div>
    </PageShell>
  );
}

export function ProfileSettingsView() {
  const t = useTranslations();
  const { user } = useAuth();
  if (!user) return null;
  const none = t("profile.noInfo");
  return (
    <PageShell title={t("profile.hub.settings")} testId="profile-settings-page">
      <div className="space-y-3 rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold">{t("profile.info")}</h2>
          <Button asChild variant="outline" size="sm">
            <Link href="/profile/edit">{t("profile.editProfile")}</Link>
          </Button>
        </div>
        <Separator />
        <InfoRow label={t("profile.edit.fields.phone")} value={user.phone || none} />
        <InfoRow label={t("profile.edit.fields.bio")} value={user.bio || none} />
        <InfoRow label={t("profile.edit.fields.city")} value={user.city || none} />
        <InfoRow label={t("profile.edit.fields.province")} value={user.province || none} />
      </div>

      <div className="space-y-3 rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="font-medium">{t("profile.theme")}</span>
          <ThemeToggle />
        </div>
        <Separator />
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="font-medium">{t("profile.language")}</span>
          <LocaleSwitcher />
        </div>
      </div>
    </PageShell>
  );
}
