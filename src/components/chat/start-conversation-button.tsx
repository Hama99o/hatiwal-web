"use client";

import { useEffect, useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, MessageCircle, Tag } from "lucide-react";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { useIsOwner, useServerViewerId } from "@/components/auth/owner-gate";
import {
  getConversations,
  sendMessage,
  startConversation,
} from "@/lib/api/chat";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";
import { OfferQuickChips } from "@/components/shared/offer-quick-chips";
import { unsettledProps, useQueuedTap } from "@/lib/unsettled";
import { cn } from "@/lib/utils";

/**
 * Listing-detail buyer actions: message the seller or make a price offer.
 * Guests → a real sign-in link, in the server HTML; the listing's own seller →
 * nothing; a viewer whose session genuinely isn't resolved yet → a held tap,
 * never a guess (see the branch comments below).
 * Both actions resolve
 * (or create) the one conversation for this buyer+listing; the backend returns
 * 422 when a conversation already exists, so we fall back to fetching it — same
 * duplicate-handling as the mobile offer flow, so a message/offer is never lost.
 *
 * `layout` changes only presentation — the inline detail column stacks
 * full-width buttons; the sticky `ListingActionBar` needs a compact row and
 * carries the primary CTA alone (see below). The mutations/dialogs are shared by
 * both so the two entry points always behave identically (never copy this
 * component to restyle it).
 */
export function StartConversationButton({
  listingId,
  sellerId,
  price,
  currency,
  negotiable,
  layout = "stacked",
  onDialogOpenChange,
}: {
  listingId: number;
  sellerId?: number;
  price?: number | null;
  currency?: string | null;
  /** false = firm price: hide the make-offer affordance (mirrors mobile N071). */
  negotiable?: boolean;
  /** `stacked` = full-width column buttons; `bar` = compact row (sticky bar). */
  layout?: "stacked" | "bar";
  /**
   * Told whenever one of the dialogs below is OPEN AND RENDERED. The shared
   * `Dialog` is portalled to <body>, so hiding the host no longer hides the
   * dialog — but unmounting the host still destroys it along with whatever the
   * buyer had typed. The sticky `ListingActionBar` uses this to keep itself
   * mounted (and to hand focus over on close) while it hosts a dialog.
   */
  onDialogOpenChange?: (open: boolean) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const qc = useQueryClient();
  const { status } = useAuth();
  // Shared owner rule (`useIsOwner`) — the same test <OwnerListingBar>,
  // <SaveButton>, <SafetyTips> and the sticky bar use, so a seller can never see
  // a "message yourself" CTA through one entry point but not another.
  const isOwner = useIsOwner(sellerId);
  const [open, setOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const msgTitleId = useId();
  const offerTitleId = useId();

  // The two early returns below stop RENDERING the dialogs without touching
  // `open`/`offerOpen`, so the report has to be gated on the same condition:
  // otherwise a viewer who stops being authed mid-compose (logout in this tab, a
  // refresh() that resolves guest) unmounts the dialogs while the parent keeps
  // believing one is open — latched true forever.
  const dialogsMounted = !isOwner && status === "authed";

  // One place to report "a dialog of mine is open", so no open/close path can
  // forget to (there are several: the two buttons, Cancel, Escape, the backdrop,
  // and the unmount that follows a successful send — hence the cleanup).
  useEffect(() => {
    onDialogOpenChange?.(dialogsMounted && (open || offerOpen));
    return () => onDialogOpenChange?.(false);
  }, [open, offerOpen, dialogsMounted, onDialogOpenChange]);

  // ── Which viewer is this, right now? ──────────────────────────────────────
  // `status` starts "loading" on EVERY load (auth-provider.tsx: one
  // /api/auth/session round trip, retried with backoff), and the sticky bar makes
  // that window maximally visible — its CTA is pinned from the first paint. But
  // the answer usually already exists: a `force-dynamic` page reads the session
  // cookies during SSR and publishes the result (see `useServerViewerId`), so the
  // branch below is chosen from the truth rather than from a guess.
  const serverViewerId = useServerViewerId();
  // The server said "no session came with this request", which the browser cannot
  // contradict (there are no cookies for it to find). So a guest gets the real
  // sign-in link in the server HTML — working before hydration, with JS off, and
  // when the probe never answers at all.
  const serverGuest = serverViewerId === null;
  const guest = status === "guest" || (status === "loading" && serverGuest);
  // Left over: signed in per the hint but the user object hasn't landed. (This
  // component only ever renders under a `ViewerIdProvider` — the listing detail
  // and seller pages are both `force-dynamic` — so "no hint at all" is not a
  // reachable third case here; the heart beside it is the control that also lives
  // on ISR pages, and it handles that case itself.) A tap cannot run yet, so it
  // is held — never dropped, and never turned into a /login link for someone the
  // server just told us is signed in (that was the whole defect).
  const unsettled = status === "loading" && !serverGuest;

  // Replay a held tap the moment auth resolves, against the RESOLVED identity —
  // so it can neither be swallowed nor send a signed-in buyer to /login. Same
  // contract, same module, as the heart beside it (see save-button.tsx).
  const { queued: queuedMessage, queue: queueMessage } = useQueuedTap(
    status === "loading",
    () => {
      if (status !== "authed") {
        router.push("/login");
        return;
      }
      setOpen(true);
    },
  );

  // Negotiable by default: only firm (offer hidden) when explicitly false.
  const isNegotiable = negotiable !== false;
  const compact = layout === "bar";
  // Compact row inside the sticky bar vs full-width stack in the detail column.
  // In the bar the primary button takes all the leftover width — the price
  // beside it is `shrink-0`, because a truncated price would misinform a buyer.
  const wrapperClass = compact
    ? "flex min-w-0 flex-1 items-center gap-2"
    : "space-y-2";
  // `px-3` in the bar: on a 360–390px phone the row is a bold price plus an icon
  // button, and the leftover was narrower than the label — measured 98px of box
  // for a 125px primary label, i.e. clipped mid-word.
  //
  // `h-11` = 44px, the touch-target floor in docs/DESIGN_SYSTEM.md. The bar is
  // `lg:hidden`, i.e. the ONE surface on this site that is touch-only, so the
  // default 40px chrome (fine everywhere a mouse can reach) is too small here.
  //
  // NOT capped here: the sticky bar caps its whole ROW instead
  // (listing-action-bar.tsx), because a cap on the button alone applied in the
  // price-less state too and left a tablet showing ~300px of empty strip before
  // the CTA — the inverse of the slab it was added to fix.
  const primaryClass = compact
    ? "h-11 min-w-0 flex-1 overflow-hidden px-3"
    : "w-full";
  // Same label in both entry points. In the bar it drops the decorative icon
  // (the +24px of icon and gap is the difference between fitting and not) and
  // ellipsizes rather than being hard-clipped by the button's `overflow-hidden`
  // — the price beside it must never shrink, so the label is what gives. `min-w-0`
  // is what lets a flex child shrink below its content width at all.
  //
  // `listing.detail.contactSeller` — the SAME key mobile's CTA uses
  // (ListingDetail.tsx), per parity rule 2: one concept, one key, so the app and
  // the web say the same words for the same action. (Web used
  // `listing.detail.messageSeller`, which on mobile labels the composer sheet —
  // the analogue of the dialog this button opens, whose heading is still
  // `chat.startConversation.title` = the same "Message Seller" copy.)
  const primaryLabel = (
    <>
      {!compact && <MessageCircle className="size-4" />}
      <span className={compact ? "min-w-0 truncate" : undefined}>
        {t("listing.detail.contactSeller")}
      </span>
    </>
  );

  if (isOwner) return null; // your own listing — <OwnerListingBar> takes over

  // ── Guest ─────────────────────────────────────────────────────────────────
  // A real link, and it is in the SERVER HTML now that the page's viewer hint can
  // say "no session" (see `serverGuest`): the CTA works on the first tap, before
  // React has attached, which for search traffic — the bulk of listing-detail
  // visits — is the only state many buyers ever see. It also carries no
  // `aria-busy`: the server answered, so nothing about this control is pending.
  //
  // Same wrapper as the other two branches so the element in this slot never
  // changes type: React reconciles by position + type, and a `div`→`a` swap
  // unmounts the node, dropping a keyboard user's focus to <body> so the next Tab
  // restarts at the top of the document.
  if (guest) {
    return (
      <div className={wrapperClass}>
        <Button asChild className={primaryClass}>
          <Link href="/login">{primaryLabel}</Link>
        </Button>
      </div>
    );
  }

  // ── Not resolved yet ──────────────────────────────────────────────────────
  // Only reachable when the hint says there IS a session (waiting for the user
  // object) or when no page published a hint at all. The tap is HELD and replayed
  // against the resolved identity, never guessed — rendering the guest branch here
  // navigated a signed-in buyer off the listing to a login page they don't need.
  //
  // Chrome-wise this is the READY button, deliberately: `aria-busy` carries the
  // state for assistive tech and the spinner appears the instant a tap is held,
  // but nothing touches the fill or the label before that. Both louder options
  // were measured and cost more than they buy — `opacity-70` dims the label to
  // ~3.1:1 against a 4.5:1 AA floor, and a `secondary` variant drops fill-vs-bar
  // contrast from 4.97:1 to 1.19:1, i.e. the pinned primary action renders as
  // bare text with no button shape on every signed-in cold load, which is the one
  // thing the sticky bar exists to provide. See lib/unsettled.ts, where that
  // trade is decided once for every labelled control (`ReportButton` too).
  // Keeping the untapped row spinner-less also keeps it off the +24px of icon and
  // gap that decides whether the label fits on a 360px phone. The offer
  // affordance is absent here exactly as in the guest branch, so no resolution of
  // the probe changes the layout.
  if (unsettled) {
    const state = unsettledProps({
      unknown: true,
      busy: queuedMessage,
      queued: queuedMessage,
      tone: "text",
    });
    return (
      <div className={wrapperClass}>
        <Button
          type="button"
          onClick={queueMessage}
          {...state}
          className={cn(primaryClass, state.className)}
        >
          {queuedMessage && <Loader2 className="animate-spin" />}
          {primaryLabel}
        </Button>
      </div>
    );
  }

  // Resolve the conversation id for this listing, creating one with `intro`,
  // or recovering the existing conversation when the backend 422s.
  async function resolveConversationId(intro: string): Promise<number> {
    try {
      const c = await startConversation(listingId, intro);
      return c.id;
    } catch (e) {
      if ((e as { status?: number }).status === 422) {
        const existing = await getConversations(listingId);
        if (existing[0]) return existing[0].id;
      }
      throw e;
    }
  }

  async function startMessage() {
    if (!msg.trim()) return;
    setBusy(true);
    try {
      const id = await resolveConversationId(msg.trim());
      // Refresh the inbox so the new conversation shows immediately on return
      // (the global 60s staleTime would otherwise hide it).
      qc.invalidateQueries({ queryKey: ["conversations"] });
      router.push(`/conversations/${id}`);
    } catch {
      toast.error(t("chat.thread.startFailed"));
      setBusy(false);
    }
  }

  async function sendOffer() {
    const n = Number(amount);
    if (!n || n <= 0) {
      toast.error(t("listing.detail.offerInvalid"));
      return;
    }
    setBusy(true);
    try {
      const id = await resolveConversationId(t("listing.detail.defaultMessage"));
      // Body format "amount|currency|listedPrice" — parsed by MessageBubble.
      await sendMessage(id, `${n}|${currency || "AFN"}|${price ?? 0}`, "offer");
      qc.invalidateQueries({ queryKey: ["conversations"] });
      router.push(`/conversations/${id}`);
    } catch {
      toast.error(t("chat.thread.startFailed"));
      setBusy(false);
    }
  }

  return (
    <div className={wrapperClass}>
      <Button className={primaryClass} onClick={() => setOpen(true)}>
        {primaryLabel}
      </Button>
      {/* Make an offer — hidden when the listing is firm-priced (N071), and not
          carried by the sticky bar at all: measured on a 360px phone, a second
          40px control there left 98px of box for a 125px primary label, so the
          primary CTA — the thing the bar exists for — was clipped mid-word, and
          two same-size outline icon buttons (tag beside heart) read as one
          ambiguous pair. The bar keeps price + Message + Save (its spec); the
          offer keeps its full-width labelled button in the inline block, which is
          never far — the bar hides itself whenever that block is on screen. */}
      {isNegotiable && !compact && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setOfferOpen(true)}
        >
          <Tag className="size-4" />
          {t("listing.detail.makeOffer")}
        </Button>
      )}

      {/* Message dialog */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        labelledBy={msgTitleId}
        dismissible={!busy}
        className="max-w-sm space-y-4"
      >
        <h2 id={msgTitleId} className="text-lg font-semibold">
          {t("chat.startConversation.title")}
        </h2>
        <Textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          rows={3}
          placeholder={t("chat.startConversation.placeholder")}
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button onClick={startMessage} disabled={busy || !msg.trim()}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {t("chat.startConversation.send")}
          </Button>
        </div>
      </Dialog>

      {/* Offer dialog */}
      <Dialog
        open={offerOpen}
        onClose={() => setOfferOpen(false)}
        labelledBy={offerTitleId}
        dismissible={!busy}
        className="max-w-sm space-y-4"
      >
        <h2 id={offerTitleId} className="text-lg font-semibold">
          {t("listing.detail.offerTitle")}
        </h2>
            {price != null && price > 0 && (
              <p className="text-sm text-muted-foreground">
                {t("listing.detail.listedPrice", {
                  price: formatPrice(price, currency, locale),
                })}
              </p>
            )}
            <div className="space-y-3">
              <label className="block text-sm font-medium">
                {t("listing.detail.yourOffer")}
              </label>
              {/* Quick-amount chips (95/90/85% of asking) — tapping fills the
                  input without sending; hidden when the price is 0/unknown.
                  Mirrors mobile's OfferSheet (TASK-G083). */}
              <OfferQuickChips
                price={price}
                currency={currency}
                value={amount}
                onSelect={setAmount}
                disabled={busy}
              />
              <div className="flex items-center gap-2">
                <span className="rounded-md border bg-muted px-3 py-2 text-sm font-medium">
                  {currency || "AFN"}
                </span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  autoFocus
                  className="flex-1"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("listing.detail.noPaymentNote")}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setOfferOpen(false)}
                disabled={busy}
              >
                {t("common.cancel")}
              </Button>
              <Button onClick={sendOffer} disabled={busy || !amount.trim()}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                {t("listing.detail.sendOffer")}
              </Button>
            </div>
      </Dialog>
    </div>
  );
}
