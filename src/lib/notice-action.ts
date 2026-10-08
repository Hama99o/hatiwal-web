/**
 * Tappable Support notices (owner, 2026-10-12), the web half of mobile's
 * lib/noticeAction.ts: same plan, web paths. A Support notice may carry
 * `message.action` {type, labelKey, params} (api SupportNoticeJob::ACTIONS);
 * a shop or listing target opens in Seller mode as that shop (or as Me for a
 * personal listing), like a thread opened from the seller side.
 */
export type NoticeActionType = "open_invite" | "open_shop" | "open_team" | "open_verification" | "open_listing";

export interface NoticeAction {
  type: NoticeActionType | string;
  labelKey?: string;
  params?: {
    token?: string;
    shopId?: number | null;
    listingId?: number;
    subject?: "me" | "shop";
    /**
     * open_verification: the subject's CURRENT state, sent by the API each time
     * the thread is read (api 1279c62): an old "Try again" must not reopen the
     * flow while a request is under review or the badge is granted.
     */
    state?: "none" | "requested" | "verified" | "rejected" | "revoked";
  };
}

/** The button's label key for the action as it stands NOW (mobile noticeActionLabelKey). */
export function noticeActionLabelKey(action: NoticeAction): string | undefined {
  if (action.type === "open_verification") {
    if (action.params?.state === "requested") return "chat.noticeAction.underReview";
    if (action.params?.state === "verified") return "chat.noticeAction.verified";
  }
  return action.labelKey;
}

export const NOTICE_ACTION_TYPES: readonly NoticeActionType[] = [
  "open_invite",
  "open_shop",
  "open_team",
  "open_verification",
  "open_listing",
];

export const isKnownNoticeAction = (a: NoticeAction | null | undefined): a is NoticeAction =>
  !!a && NOTICE_ACTION_TYPES.includes(a.type as NoticeActionType);

export interface NoticeActionContext {
  /** Every shop the user is on, in any status. */
  memberShopIds: number[];
  /** The shops they can sell as (active). */
  activeShopIds: number[];
}

export type NoticeActionPlan =
  | {
      kind: "open";
      path: string;
      sellerMode: boolean;
      /** Sell as this identity first (null = Me); undefined = leave it. */
      switchTo?: number | null;
      check?: { invite: string } | { listing: number };
    }
  /** The target is gone: the i18n key of the toast. */
  | { kind: "gone"; messageKey: string }
  | { kind: "none" };

export const GONE_TEAM = "shops.team.noLongerOnTeam";
export const GONE_INVITE = "chat.noticeAction.gone.invite";
export const GONE_LISTING = "chat.noticeAction.gone.listing";

const asId = (v: unknown): number | null => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

export function noticeActionPlan(action: NoticeAction | null | undefined, ctx: NoticeActionContext): NoticeActionPlan {
  if (!isKnownNoticeAction(action)) return { kind: "none" };
  const p = action.params ?? {};
  const shopId = asId(p.shopId);

  const asShop = (path: string): NoticeActionPlan => {
    if (shopId == null) return { kind: "none" };
    if (!ctx.memberShopIds.includes(shopId)) return { kind: "gone", messageKey: GONE_TEAM };
    return { kind: "open", path, sellerMode: true, ...(ctx.activeShopIds.includes(shopId) ? { switchTo: shopId } : {}) };
  };

  switch (action.type as NoticeActionType) {
    case "open_invite":
      return p.token
        ? { kind: "open", path: `/join/${encodeURIComponent(p.token)}`, sellerMode: false, check: { invite: p.token } }
        : { kind: "none" };
    case "open_shop":
      return asShop(`/shops/${shopId}`);
    case "open_team":
      return asShop(`/shops/${shopId}/team`);
    case "open_verification": {
      // Under review or verified NOW: the status (shop page / Profile), never
      // the apply flow (owner bug, 2026-10-08).
      const settled = p.state === "requested" || p.state === "verified";
      if (p.subject === "shop") return asShop(settled ? `/shops/${shopId}` : `/shops/${shopId}/verify`);
      return { kind: "open", path: settled ? "/profile" : "/profile/verify", sellerMode: false };
    }
    case "open_listing": {
      const listingId = asId(p.listingId);
      if (listingId == null) return { kind: "none" };
      if (shopId != null && !ctx.memberShopIds.includes(shopId)) return { kind: "gone", messageKey: GONE_TEAM };
      const switchTo = shopId == null ? null : ctx.activeShopIds.includes(shopId) ? shopId : undefined;
      return {
        kind: "open",
        path: `/my-listings/${listingId}`,
        sellerMode: true,
        ...(switchTo !== undefined ? { switchTo } : {}),
        check: { listing: listingId },
      };
    }
  }
  return { kind: "none" };
}
