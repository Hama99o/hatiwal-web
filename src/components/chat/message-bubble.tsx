"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeftRight,
  Ban,
  Calendar,
  Check,
  Paperclip,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { splitHighlight } from "@/lib/message-search";
import type { Message } from "@/lib/types";

type RespondKind =
  | "meetup_accepted"
  | "meetup_declined"
  | "offer_accepted"
  | "offer_declined";

export function MessageBubble({
  message,
  mine,
  responded,
  onRespond,
  onCounter,
  onDelete,
  highlight,
}: {
  message: Message;
  mine: boolean;
  responded: boolean;
  onRespond: (kind: RespondKind, respondsToId: number) => void;
  /**
   * Provided only when the viewer is the seller looking at the buyer's original
   * offer (and it hasn't been answered) — opens the counter-offer dialog.
   */
  onCounter?: () => void;
  /** Provided only for the sender's own, non-deleted messages. */
  onDelete?: () => void;
  /** Active in-thread search query — matches in the body are highlighted. */
  highlight?: string;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const m = message;

  // Tombstone — a retracted message. Shown quietly to BOTH participants with no
  // original content, preserving thread order. Takes precedence over every kind.
  if (m.deleted) {
    return (
      <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
        <div
          className={cn(
            "inline-flex max-w-[82%] items-center gap-1.5 rounded-2xl border border-dashed border-border px-3.5 py-2 text-sm italic text-muted-foreground",
            mine ? "rounded-ee-sm" : "rounded-es-sm",
          )}
        >
          <Ban className="size-3.5 shrink-0" />
          {t("chat.message.deleted")}
        </div>
      </div>
    );
  }

  if (m.kind === "system") {
    return (
      <div className="my-2 flex justify-center">
        <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          {m.body}
        </span>
      </div>
    );
  }

  if (
    m.kind === "meetup_accepted" ||
    m.kind === "meetup_declined" ||
    m.kind === "offer_accepted" ||
    m.kind === "offer_declined"
  ) {
    const positive = m.kind.endsWith("accepted");
    const label = {
      meetup_accepted: t("chat.meetup.accepted"),
      meetup_declined: t("chat.meetup.declined"),
      offer_accepted: t("chat.offer.accepted"),
      offer_declined: t("chat.offer.declined"),
    }[m.kind];
    return (
      <div className="my-1 flex justify-center">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium",
            positive
              ? "bg-success/10 text-success"
              : "bg-destructive/10 text-destructive",
          )}
        >
          {positive ? <Check className="size-3" /> : <X className="size-3" />}
          {label}
        </span>
      </div>
    );
  }

  const isMeetup = m.kind === "meetup_proposal";
  const isOffer = m.kind === "offer";
  const isCounter = m.kind === "offer_counter";
  // Offer and counter-offer share the same card treatment and accept/decline flow.
  const isOfferLike = isOffer || isCounter;

  // Structured-body parsing — must match the mobile encoding exactly so a
  // message sent from either client renders identically (cross-client parity).
  // Offer body: "amount|currency|listedPrice".  Meetup body: "place | time".
  // Prefer the server pre-parsed offerAmount/offerCurrency when present.
  const mutedMeta = mine ? "text-primary-foreground/70" : "text-muted-foreground";
  let offer: { amount: number; currency: string; listed: number } | null = null;
  if (isOfferLike) {
    const [a, c, l] = m.body.split("|");
    offer = {
      amount: m.offerAmount ?? Number(a ?? 0),
      currency: m.offerCurrency || c || "AFN",
      listed: Number(l ?? 0),
    };
  }
  let meetup: { place: string; time: string } | null = null;
  if (isMeetup) {
    const [p, time] = m.body.split("|").map((s) => s.trim());
    meetup = { place: p || m.body, time: time || "" };
  }

  return (
    <div
      className={cn(
        "group flex items-center gap-1",
        mine ? "justify-end" : "justify-start",
      )}
    >
      {onDelete && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
          aria-label={t("chat.message.deleteAction")}
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
        </Button>
      )}
      <div
        className={cn(
          "max-w-[82%] rounded-2xl px-3.5 py-2 text-sm",
          isMeetup || isOfferLike ? "min-w-[180px]" : "",
          mine
            ? "rounded-ee-sm bg-primary text-primary-foreground"
            : "rounded-es-sm bg-muted text-foreground",
        )}
      >
        {(isMeetup || isOfferLike) && (
          <div
            className={cn(
              "mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide",
              mutedMeta,
            )}
          >
            {isMeetup ? (
              <Calendar className="size-3.5" />
            ) : isCounter ? (
              <ArrowLeftRight className="size-3.5" />
            ) : (
              <Tag className="size-3.5" />
            )}
            {isMeetup
              ? t("chat.meetup.proposed")
              : isCounter
                ? t("chat.offer.counterLabel")
                : t("chat.offer.label")}
          </div>
        )}
        {offer ? (
          <>
            <p className={cn("text-xs font-medium", mutedMeta)}>
              {isCounter ? t("chat.offer.counteredAt") : t("chat.offer.yourOffer")}
            </p>
            <p className="text-2xl font-extrabold leading-none">
              {formatPrice(offer.amount, offer.currency, locale)}
            </p>
            {/* Counter cards omit the listed-price line to mirror mobile. */}
            {isOffer && offer.listed > 0 && (
              <p className={cn("mt-1 text-xs", mutedMeta)}>
                {t("chat.offer.listedAt", {
                  price: formatPrice(offer.listed, offer.currency, locale),
                })}
              </p>
            )}
          </>
        ) : meetup ? (
          <div className="space-y-1.5">
            <div>
              <p className={cn("text-[11px] font-medium", mutedMeta)}>
                {t("chat.meetup.place")}
              </p>
              <p className="font-medium leading-tight">{meetup.place || "—"}</p>
            </div>
            {meetup.time && (
              <div>
                <p className={cn("text-[11px] font-medium", mutedMeta)}>
                  {t("chat.meetup.time")}
                </p>
                <p className="font-medium leading-tight">{meetup.time}</p>
              </div>
            )}
          </div>
        ) : m.attachmentUrl ? (
          m.kind === "image_message" ? (
            // Active Storage disk URLs carry no extension, so key off the kind.
            <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.attachmentUrl}
                alt={m.body || t("chat.preview.photo")}
                className="max-h-60 w-auto max-w-full rounded-lg object-cover"
              />
            </a>
          ) : (
            <a
              href={m.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 underline"
            >
              <Paperclip className="size-4 shrink-0" />
              {m.body || t("chat.preview.file")}
            </a>
          )
        ) : (
          <p className="whitespace-pre-wrap break-words">
            {highlight
              ? splitHighlight(m.body, highlight).map((part, i) =>
                  part.isMatch ? (
                    <mark
                      key={i}
                      className="rounded-sm bg-brand-gold/40 text-inherit"
                    >
                      {part.text}
                    </mark>
                  ) : (
                    <span key={i}>{part.text}</span>
                  ),
                )
              : m.body}
          </p>
        )}
        {(isMeetup || isOfferLike) && !mine && !responded && (
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="h-7"
              onClick={() =>
                onRespond(isMeetup ? "meetup_accepted" : "offer_accepted", m.id)
              }
            >
              {t(isMeetup ? "chat.meetup.accept" : "chat.offer.accept")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7"
              onClick={() =>
                onRespond(isMeetup ? "meetup_declined" : "offer_declined", m.id)
              }
            >
              {t(isMeetup ? "chat.meetup.decline" : "chat.offer.decline")}
            </Button>
            {/* Counter — only the seller sees this on the buyer's original offer. */}
            {isOffer && onCounter && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5"
                onClick={onCounter}
              >
                <ArrowLeftRight className="size-3.5" />
                {t("chat.offer.counter")}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
