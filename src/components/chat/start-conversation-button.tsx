"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, MessageCircle, Tag } from "lucide-react";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import {
  getConversations,
  sendMessage,
  startConversation,
} from "@/lib/api/chat";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Listing-detail buyer actions: message the seller or make a price offer.
 * Guests → sign in; the listing's own seller → nothing. Both actions resolve
 * (or create) the one conversation for this buyer+listing; the backend returns
 * 422 when a conversation already exists, so we fall back to fetching it — same
 * duplicate-handling as the mobile offer flow, so a message/offer is never lost.
 */
export function StartConversationButton({
  listingId,
  sellerId,
  price,
  currency,
}: {
  listingId: number;
  sellerId?: number;
  price?: number | null;
  currency?: string | null;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { status, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  if (status === "authed" && user && sellerId && user.id === sellerId) {
    return null; // your own listing
  }

  if (status !== "authed") {
    return (
      <Button asChild className="w-full">
        <Link href="/login">
          <MessageCircle className="size-4" />
          {t("listing.detail.messageSeller")}
        </Link>
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
      router.push(`/conversations/${id}`);
    } catch {
      toast.error(t("chat.thread.startFailed"));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button className="w-full" onClick={() => setOpen(true)}>
        <MessageCircle className="size-4" />
        {t("listing.detail.messageSeller")}
      </Button>
      <Button
        variant="outline"
        className="w-full"
        onClick={() => setOfferOpen(true)}
      >
        <Tag className="size-4" />
        {t("listing.detail.makeOffer")}
      </Button>

      {/* Message dialog */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !busy && setOpen(false)}
          />
          <div className="relative z-10 w-full max-w-sm space-y-4 rounded-lg border bg-card p-6 shadow-lg">
            <h2 className="text-lg font-semibold">
              {t("chat.startConversation.title")}
            </h2>
            <textarea
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              rows={3}
              autoFocus
              placeholder={t("chat.startConversation.placeholder")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                {t("common.cancel")}
              </Button>
              <Button onClick={startMessage} disabled={busy || !msg.trim()}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                {t("chat.startConversation.send")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Offer dialog */}
      {offerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !busy && setOfferOpen(false)}
          />
          <div className="relative z-10 w-full max-w-sm space-y-4 rounded-lg border bg-card p-6 shadow-lg">
            <h2 className="text-lg font-semibold">
              {t("listing.detail.offerTitle")}
            </h2>
            {price != null && price > 0 && (
              <p className="text-sm text-muted-foreground">
                {t("listing.detail.listedPrice", {
                  price: formatPrice(price, currency, locale),
                })}
              </p>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {t("listing.detail.yourOffer")}
              </label>
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
          </div>
        </div>
      )}
    </div>
  );
}
