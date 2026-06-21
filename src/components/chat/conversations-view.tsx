"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { MessageSquare } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getConversations } from "@/lib/api/chat";
import type { Conversation } from "@/lib/types";
import { UserAvatar } from "@/components/shared/user-avatar";
import { RemoteImage } from "@/components/shared/remote-image";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";

function preview(c: Conversation, t: ReturnType<typeof useTranslations>): string {
  switch (c.lastMessageKind) {
    case "meetup_proposal":
      return t("chat.preview.meetup");
    case "offer": {
      // Body is "amount|currency|listedPrice" — same parse as mobile's row.
      const [amount, currency] = (c.lastMessageBody || "").split("|");
      return t("chat.preview.offer", {
        amount: amount || "?",
        currency: currency || "AFN",
      });
    }
    case "meetup_accepted":
      return t("chat.preview.meetupAccepted");
    case "meetup_declined":
      return t("chat.preview.meetupDeclined");
    case "offer_accepted":
      return t("chat.preview.offerAccepted");
    case "offer_declined":
      return t("chat.preview.offerDeclined");
    case "document":
      return t("chat.preview.file");
    case "image_message":
      return t("chat.preview.photo");
    default:
      return c.lastMessageBody || t("chat.noMessages");
  }
}

export function ConversationsView({ listingId }: { listingId?: number } = {}) {
  const t = useTranslations();
  const locale = useLocale();
  const { data, isPending, isError } = useQuery({
    queryKey: ["conversations", listingId ?? "all"],
    queryFn: () => getConversations(listingId),
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold tracking-tight">
        {listingId ? t("chat.listingFilter.title") : t("chat.title")}
      </h1>
      {listingId ? (
        <Link
          href="/conversations"
          className="mb-6 inline-block text-sm text-primary hover:underline"
        >
          {t("chat.listingFilter.viewAll")}
        </Link>
      ) : (
        <div className="mb-4" />
      )}

      {isError ? (
        <EmptyState icon={MessageSquare} title={t("common.error")} />
      ) : isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={t("chat.noConversations")}
          description={t("chat.noConversationsDescription")}
          action={{ label: t("chat.empty.browseAction"), href: "/bazaar" }}
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {data.map((c) => {
            const who = c.otherParticipant;
            const unread = (c.unreadCount ?? 0) > 0;
            return (
              <li key={c.id}>
                <Link
                  href={`/conversations/${c.id}`}
                  className="flex items-center gap-3 p-3 transition-colors hover:bg-accent"
                >
                  <UserAvatar
                    name={who?.name ?? t("chat.unknownUser")}
                    avatarUrl={who?.avatarUrl}
                    size={48}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold">
                        {who?.name ?? t("chat.unknownUser")}
                      </span>
                      {c.lastMessageAt && (
                        <span
                          className={cn(
                            "shrink-0 text-xs",
                            unread
                              ? "font-medium text-primary"
                              : "text-muted-foreground",
                          )}
                        >
                          {formatRelativeDate(c.lastMessageAt, locale)}
                        </span>
                      )}
                    </div>
                    <p
                      className={cn(
                        "truncate text-sm",
                        unread
                          ? "font-medium text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {preview(c, t)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.listing.title}
                    </p>
                  </div>
                  <div className="relative shrink-0">
                    <div className="size-12 overflow-hidden rounded-md bg-muted">
                      <RemoteImage
                        src={c.listing.thumbnailUrl}
                        alt={c.listing.title}
                        width={48}
                        height={48}
                        className="size-12 object-cover"
                      />
                    </div>
                    {unread && (
                      <span className="absolute -end-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-card bg-primary px-1 text-[11px] font-bold leading-none text-primary-foreground">
                        {(c.unreadCount ?? 0) > 9 ? "9+" : c.unreadCount}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
