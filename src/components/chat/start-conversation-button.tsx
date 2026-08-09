"use client";

import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, MessageCircle, Tag } from "lucide-react";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { useIsOwner } from "@/components/auth/owner-gate";
import {
  getConversations,
  sendMessage,
  startConversation,
} from "@/lib/api/chat";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { OfferQuickChips } from "@/components/shared/offer-quick-chips";

/**
 * Listing-detail buyer actions: message the seller or make a price offer.
 * Guests → sign in; the listing's own seller → nothing. Both actions resolve
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
}: {
  listingId: number;
  sellerId?: number;
  price?: number | null;
  currency?: string | null;
  /** false = firm price: hide the make-offer affordance (mirrors mobile N071). */
  negotiable?: boolean;
  /** `stacked` = full-width column buttons; `bar` = compact row (sticky bar). */
  layout?: "stacked" | "bar";
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

  // Negotiable by default: only firm (offer hidden) when explicitly false.
  const isNegotiable = negotiable !== false;
  const compact = layout === "bar";
  // Compact row inside the sticky bar vs full-width stack in the detail column.
  // In the bar the primary button takes all the leftover width — the price
  // beside it is `shrink-0`, because a truncated price would misinform a buyer.
  const wrapperClass = compact
    ? "flex min-w-0 flex-1 items-center gap-2"
    : "space-y-2";
  // `px-3` in the bar: on a 360–390px phone the row is a bold price plus two
  // 40px icon buttons, and the leftover was narrower than the label — measured
  // 98px of box for 125px of "Message Seller", i.e. clipped mid-word.
  const primaryClass = compact
    ? "min-w-0 flex-1 overflow-hidden px-3"
    : "w-full";
  // Same label in both entry points. In the bar it drops the decorative icon
  // (the +24px of icon and gap is the difference between fitting and not) and
  // ellipsizes rather than being hard-clipped by the button's `overflow-hidden`
  // — the price beside it must never shrink, so the label is what gives. `min-w-0`
  // is what lets a flex child shrink below its content width at all.
  const primaryLabel = (
    <>
      {!compact && <MessageCircle className="size-4" />}
      <span className={compact ? "min-w-0 truncate" : undefined}>
        {t("listing.detail.messageSeller")}
      </span>
    </>
  );

  if (isOwner) return null; // your own listing — <OwnerListingBar> takes over

  if (status !== "authed") {
    return (
      <Button asChild className={primaryClass}>
        <Link href="/login">{primaryLabel}</Link>
      </Button>
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
          40px control there left 98px of box for a 125px "Message Seller", so the
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
        <textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          rows={3}
          placeholder={t("chat.startConversation.placeholder")}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
