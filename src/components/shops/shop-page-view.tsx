"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BarChart3, MessageCircle, Navigation, Pencil, Phone, Store, Users } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { useLoginHref } from "@/components/auth/login-href";
import { ApiError } from "@/lib/api/client";
import { messageShop } from "@/lib/api/chat";
import { apiErrorMessage, isNetworkFailure } from "@/lib/api/error-codes";
import { useAuth } from "@/components/auth/auth-provider";
import { UserAvatar } from "@/components/shared/user-avatar";
import { VerifiedBadge } from "@/components/shared/verified-badge";
import { ShopChip } from "@/components/shared/shop-chip";
import { ShareButton } from "@/components/shared/share-button";
import { EmptyState } from "@/components/shared/empty-state";
import { ListingGrid, ListingGridSkeleton } from "@/components/shared/listing-grid";
import { RemoteImage } from "@/components/shared/remote-image";
import { ShopReviews } from "@/components/shops/shop-reviews";
import { LocationMap } from "@/components/map/location-map";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { getListings } from "@/lib/api/listings";
import type { Shop } from "@/lib/api/shops";
import { SHOP_DAYS, dayOf, hasHours, shopOpenText } from "@/lib/shop-hours";
import { shopShareText } from "@/lib/shop-share";
import { cn } from "@/lib/utils";
import { ShopVerificationCard } from "./shop-verification-card";
import { shopCan } from "@/lib/shop-permissions";
import { userTextProps } from "@/lib/text-direction";

type Tab = "products" | "reviews" | "about";

export const PUBLIC_SITE = "https://hatiwal.com";

/** "Share my shop" link: always https://hatiwal.com/s/<id> (docs/SHOPS.md). */
export function shopShareUrl(shop: Pick<Shop, "id" | "shareUrl">): string {
  return shop.shareUrl && /^https:\/\//i.test(shop.shareUrl) ? shop.shareUrl : `${PUBLIC_SITE}/s/${shop.id}`;
}

function OpenLine({ shop }: { shop: Shop }) {
  const t = useTranslations("shops");
  // From the API (Asia/Kabul): the same on the server render and the client,
  // so no hydration mismatch. Same wording as the share text (shopOpenText).
  const line = shopOpenText(shop, t as never, useLocale());
  if (!line) return null;
  const { open, text } = line;
  return (
    <p className={cn("flex items-center gap-1.5 text-sm font-semibold", open ? "text-success" : "text-muted-foreground")} data-testid="shop-open-status">
      <span className={cn("size-2 rounded-full", open ? "bg-success" : "bg-destructive")} aria-hidden />
      {text}
    </p>
  );
}

/**
 * The shop page body (Glovo logo-over-cover; Fresha/Subway hours, Directions,
 * Call). SHOP-2: "Message shop" (no product) for anyone who is not a member.
 * testids mirror mobile (shop-page, shop-tab-*, shop-directions, shop-call…).
 */
export function ShopPageView({ shop, categoryLabel }: { shop: Shop; categoryLabel: string | null }) {
  const t = useTranslations("shops");
  const tRoot = useTranslations();
  const locale = useLocale();
  const { user, status, probeTimedOut } = useAuth();
  // Only a CONFIRMED guest gets the sign-in link: while the session probe is
  // still answering, a signed-in buyer's early click must not land on /login.
  const isGuest = status === "guest" || (status === "loading" && probeTimedOut);
  const [tab, setTab] = useState<Tab>("products");
  const membership = user?.shops?.find((s) => s.id === shop.id);
  const isMember = !!membership;
  // SHOP-3 (the Owner / Manager / Staff matrix, api 76ca115): every member
  // reaches the Team page; owner + managers edit the shop; only the owner
  // applies for the badge (it's their own ID).
  const canEdit = shopCan(membership?.role, "editShop");
  const canVerify = shopCan(membership?.role, "applyVerified");
  const router = useRouter();
  const qc = useQueryClient();
  const loginHref = useLoginHref();
  // SHOP-2: find-or-create the one listing-less chat with this shop.
  const message = useMutation({
    mutationFn: () => messageShop(shop.id),
    onSuccess: (conversation) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      router.push(`/conversations/${conversation.id}`);
    },
    onError: (err) => {
      // No answer at all is the only "check your connection".
      if (isNetworkFailure(err)) {
        toast.error(tRoot("common.offline"));
        return;
      }
      const status = err instanceof ApiError ? err.status : 0;
      const code = err instanceof ApiError ? err.code : undefined;
      // Blocked either way is a 422 with the same server message as starting a
      // listing chat (localized by the API), so a 422 without a known code shows it.
      // A block is said in the reader's language (codes blocked / blocked_by).
      const coded = apiErrorMessage(err, tRoot);
      if (coded) {
        toast.error(coded);
        return;
      }
      if (err instanceof ApiError && status === 422 && !code && err.errors[0]) {
        toast.error(err.errors[0]);
        return;
      }
      toast.error(
        t(
          status === 404 || code === "shop_unavailable"
              ? "messageErrors.unavailable"
              : status === 429
                ? "messageErrors.tooMany"
                : "messageErrors.failed",
        ),
      );
    },
  });

  const { data: products, isPending } = useQuery({
    queryKey: ["shop-products", shop.id],
    queryFn: () => getListings({ shopId: shop.id, pageSize: 48 }),
    enabled: tab === "products",
  });

  const lat = Number(shop.latitude);
  const lng = Number(shop.longitude);
  const directions = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  const subtitle = [categoryLabel, shop.city ?? shop.province].filter(Boolean).join(" · ");
  const today = dayOf(new Date());
  // The share carries the shop's details in the reader's language (owner,
  // 2026-10-08), the same lines as mobile's buildShopShareText.
  const shareText = shopShareText(shop, {
    t: t as never,
    locale,
    categoryLabel,
    openText: shopOpenText(shop, t as never, locale)?.text ?? null,
  });

  return (
    <div className="mx-auto max-w-5xl pb-12" data-testid="shop-page">
      <div className="relative h-44 w-full overflow-hidden bg-brand-lapis sm:h-56 sm:rounded-b-2xl">
        {shop.coverUrl && <RemoteImage src={shop.coverMediumUrl ?? shop.coverUrl} fallbackSrc={shop.coverUrl} alt="" fill sizes="100vw" className="object-cover" />}
      </div>
      <div className="space-y-3 px-4">
        <div className="-mt-10 flex items-end justify-between gap-3">
          <span className="rounded-[22px] border-4 border-background">
            <UserAvatar variant="shop" name={shop.name} avatarUrl={shop.logoUrl} avatarFallbackUrl={shop.logoOriginalUrl} size={80} />
          </span>
          {/* Wraps beside the logo: three member buttons are wider than a phone
              (design QA 1.1.6: the page scrolled sideways at 390px). */}
          <div className="flex min-w-0 flex-wrap justify-end gap-2">
            {/* Item 2: this shop's numbers, for every member. */}
            {isMember && (
              <Button asChild variant="outline" data-testid="shop-page-analytics">
                <Link href={`/analytics?shop=${shop.id}`}>
                  <BarChart3 className="size-4" /> {tRoot("seller.analytics.title")}
                </Link>
              </Button>
            )}
            {isMember && (
              <Button asChild variant="outline" data-testid="shop-page-team">
                <Link href={`/shops/${shop.id}/team`}>
                  <Users className="size-4" /> {t("team.title")}
                </Link>
              </Button>
            )}
            {canEdit && (
              <Button asChild variant="outline" data-testid="shop-page-edit">
                <Link href={`/shops/${shop.id}/edit`}>
                  <Pencil className="size-4" /> {t("edit")}
                </Link>
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <h1 className="text-title font-extrabold" data-testid="shop-page-name" {...userTextProps(shop.name)}>
            {shop.name}
          </h1>
          {shop.verified && (
            <span data-testid="shop-verified-badge">
              <VerifiedBadge />
            </span>
          )}
        </div>
        {shop.verified && <p className="text-sm font-semibold text-primary">{t("verified")}</p>}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShopChip />
          {subtitle && <span className="truncate">{subtitle}</span>}
        </div>
        <OpenLine shop={shop} />
        <div className="flex flex-wrap gap-2">
          {!isMember &&
            (!isGuest ? (
              <Button onClick={() => message.mutate()} disabled={status !== "authed" || message.isPending} data-testid="shop-message">
                <MessageCircle className="size-4" /> {t("message")}
              </Button>
            ) : (
              <Button asChild data-testid="shop-message">
                <Link href={loginHref({ includeQuery: false })}>
                  <MessageCircle className="size-4" /> {t("message")}
                </Link>
              </Button>
            ))}
          <Button asChild variant="outline" data-testid="shop-directions">
            <a href={directions} target="_blank" rel="noopener noreferrer">
              <Navigation className="size-4" /> {t("directions")}
            </a>
          </Button>
          {shop.phone && (
            <Button asChild variant="outline" data-testid="shop-call">
              <a href={`tel:${shop.phone}`}>
                <Phone className="size-4" /> {t("call")}
              </a>
            </Button>
          )}
          {/* The ONE share button (owner, 2026-10-08: the small icon beside the
              header buttons is gone). For everyone: members share "my shop",
              buyers "this shop". */}
          <ShareButton
            shareTitle={shop.name}
            text={shareText}
            url={shopShareUrl(shop)}
            label={isMember ? t("share.button") : t("share.buttonOther")}
            variant="default"
            testId="shop-share-button"
          />
        </div>

        {/* SHOP-1: the owner's "Get the Verified shop ✓ badge" card. */}
        {/* The owner and managers only; staff never see it (owner, 2026-10-08).
            The ✓ on the shop itself stays public. */}
        {canVerify && <ShopVerificationCard shopId={shop.id} />}

        <div role="tablist" className="flex rounded-lg bg-muted p-1">
          {(["products", "reviews", "about"] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              data-testid={`shop-tab-${key}`}
              className={cn("flex-1 rounded-md py-2 text-sm", tab === key ? "bg-card font-bold shadow-sm" : "text-muted-foreground")}
            >
              {key === "products" ? t("tabs.productsCount", { count: shop.listingsCount }) : t(`tabs.${key}`)}
            </button>
          ))}
        </div>

        {tab === "products" &&
          (isPending ? (
            <ListingGridSkeleton count={6} />
          ) : products && products.items.length > 0 ? (
            <ListingGrid listings={products.items} />
          ) : (
            <EmptyState
              icon={Store}
              title={isMember ? t("empty.productsOwner") : t("empty.products")}
              action={isMember ? { label: t("empty.addProduct"), href: "/listings/new" } : undefined}
            />
          ))}

        {tab === "reviews" && <ShopReviews shopId={shop.id} />}

        {tab === "about" && (
          <div className="space-y-6" data-testid="shop-page-about">
            {shop.description && (
              <section className="space-y-1.5">
                <h2 className="font-bold">{t("about.description")}</h2>
                <p {...userTextProps(shop.description)} data-testid="shop-page-description">{shop.description}</p>
              </section>
            )}
            <section className="space-y-2">
              <h2 className="font-bold">{t("about.address")}</h2>
              <p {...userTextProps(shop.addressLine)}>{shop.addressLine}</p>
              {Number.isFinite(lat) && Number.isFinite(lng) && <LocationMap lat={lat} lng={lng} className="h-56 rounded-lg" />}
            </section>
            <section className="space-y-2">
              <h2 className="font-bold">{t("about.hours")}</h2>
              {hasHours(shop.hours) ? (
                <dl className="space-y-1 text-sm">
                  {SHOP_DAYS.map((day) => {
                    const ranges = shop.hours[day];
                    return (
                      <div key={day} className={cn("flex justify-between", day === today && "font-extrabold")} data-testid={`shop-hours-${day}`}>
                        <dt>
                          {t(`days.${day}`)}
                          {day === today && ` · ${t("about.today")}`}
                        </dt>
                        <dd className={cn(!ranges?.length && "text-muted-foreground")}>
                          {ranges === undefined ? "—" : ranges.length ? ranges.map(([a, b]) => `${a}–${b}`).join(", ") : t("about.closed")}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">{t("about.noHours")}</p>
              )}
            </section>
            <p className="text-sm text-muted-foreground">{t("about.since", { date: formatDate(shop.createdAt, locale) })}</p>
          </div>
        )}
      </div>
    </div>
  );
}
