"use client";

import { useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import {
  Archive,
  ArchiveRestore,
  CheckCheck,
  Inbox,
  MailOpen,
  MessageSquare,
  MoreVertical,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import {
  archiveConversation,
  getConversations,
  markConversationRead,
  markConversationUnread,
  unarchiveConversation,
} from "@/lib/api/chat";
import { useAuth } from "@/components/auth/auth-provider";
import type { Conversation } from "@/lib/types";
import { UserAvatar } from "@/components/shared/user-avatar";
import { RemoteImage } from "@/components/shared/remote-image";
import { EmptyState } from "@/components/shared/empty-state";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatRelativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type TabMode = "inbox" | "archived";

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
  const queryClient = useQueryClient();
  const { refresh } = useAuth();
  const [tab, setTab] = useState<TabMode>("inbox");

  // The Inbox/Archived partition only applies to the full inbox, not the
  // per-listing filtered view (which mirrors mobile's listing-scoped list).
  const archived = !listingId && tab === "archived";
  const queryKey = [
    "conversations",
    listingId ?? "all",
    archived ? "archived" : "inbox",
  ];

  const { data, isPending, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => getConversations(listingId, archived),
  });

  // Optimistically drop the row from the current list; on error restore it and
  // toast. Invalidate both partitions so the moved row appears on the other tab.
  const mutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "archive" | "unarchive" }) =>
      action === "archive"
        ? archiveConversation(id)
        : unarchiveConversation(id),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Conversation[]>(queryKey);
      queryClient.setQueryData<Conversation[]>(queryKey, (old) =>
        (old ?? []).filter((c) => c.id !== id),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
      toast.error(t("chat.archive.error"));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  // Mark a conversation read/unread from the list without opening it.
  // Optimistically flip the row's unreadCount (0 = read, 1 = unread) so the
  // row + badge update instantly; roll back + toast on error. On success we
  // also refresh the user so the header's aggregate unread badge stays in sync.
  const readMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "read" | "unread" }) =>
      action === "read"
        ? markConversationRead(id)
        : markConversationUnread(id),
    onMutate: async ({ id, action }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Conversation[]>(queryKey);
      queryClient.setQueryData<Conversation[]>(queryKey, (old) =>
        (old ?? []).map((c) =>
          c.id === id ? { ...c, unreadCount: action === "read" ? 0 : 1 } : c,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
      toast.error(t("chat.actions.markReadError"));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      // Keep the header's aggregate unread badge (user.unreadMessageCount) fresh.
      refresh().catch(() => undefined);
    },
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
        // Inbox / Archived segmented control
        <SegmentedControl<TabMode>
          className="mb-4 mt-2"
          ariaLabel={t("chat.tabs.label")}
          value={tab}
          onChange={setTab}
          options={[
            { value: "inbox", label: t("chat.tabs.inbox"), icon: Inbox },
            { value: "archived", label: t("chat.tabs.archived"), icon: Archive },
          ]}
        />
      )}

      {isError ? (
        <EmptyState
          icon={MessageSquare}
          title={t("common.errorTitle")}
          description={t("common.errorDescription")}
          action={{ label: t("common.retry"), onClick: () => refetch() }}
        />
      ) : isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        archived ? (
          <EmptyState
            icon={Archive}
            title={t("chat.archive.empty")}
            description={t("chat.archive.emptyDescription")}
          />
        ) : (
          <EmptyState
            icon={MessageSquare}
            title={t("chat.noConversations")}
            description={t("chat.noConversationsDescription")}
            action={{ label: t("chat.empty.browseAction"), href: "/bazaar" }}
          />
        )
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {data.map((c) => {
            const who = c.otherParticipant;
            const unread = (c.unreadCount ?? 0) > 0;
            return (
              <li key={c.id} className="relative flex items-center">
                <Link
                  href={`/conversations/${c.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 p-3 transition-colors hover:bg-accent"
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
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={t("chat.actions.options")}
                    className="me-2 flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <MoreVertical className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {unread ? (
                      <DropdownMenuItem
                        onSelect={() =>
                          readMutation.mutate({ id: c.id, action: "read" })
                        }
                      >
                        <CheckCheck className="size-4" />
                        {t("chat.actions.markRead")}
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onSelect={() =>
                          readMutation.mutate({ id: c.id, action: "unread" })
                        }
                      >
                        <MailOpen className="size-4" />
                        {t("chat.actions.markUnread")}
                      </DropdownMenuItem>
                    )}
                    {archived ? (
                      <DropdownMenuItem
                        onSelect={() =>
                          mutation.mutate({ id: c.id, action: "unarchive" })
                        }
                      >
                        <ArchiveRestore className="size-4" />
                        {t("chat.archive.unarchive")}
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onSelect={() =>
                          mutation.mutate({ id: c.id, action: "archive" })
                        }
                      >
                        <Archive className="size-4" />
                        {t("chat.archive.archive")}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
