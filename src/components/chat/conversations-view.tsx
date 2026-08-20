"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import {
  Archive,
  ArchiveRestore,
  CheckCheck,
  Inbox,
  Loader2,
  MailOpen,
  MessageSquare,
  MoreVertical,
  SearchX,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import {
  archiveConversation,
  getConversations,
  markConversationRead,
  markConversationUnread,
  unarchiveConversation,
  type ConversationsResult,
} from "@/lib/api/chat";
import { useAuth } from "@/components/auth/auth-provider";
import type { Conversation } from "@/lib/types";
import { UserAvatar } from "@/components/shared/user-avatar";
import { CountBadge } from "@/components/shared/count-badge";
import { HighlightedText } from "@/components/shared/highlighted-text";
import { RemoteImage } from "@/components/shared/remote-image";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchField } from "@/components/shared/search-field";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { conversationPreviewText } from "@/lib/conversation-preview";
import { filterConversations } from "@/lib/filter-conversations";
import { formatPrice, formatRelativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type TabMode = "inbox" | "archived";

/** The infinite-query cache shape for one inbox partition. */
type ConversationPages = InfiniteData<ConversationsResult>;

/**
 * Apply `fn` to every loaded page's rows. The optimistic archive/mark-read
 * mutations below write through this instead of treating the cache as a flat
 * array — with `useInfiniteQuery` the cache is `{ pages: [{ items, pagination }] }`,
 * so a row on page 2 has to be patched where it actually lives.
 */
function patchPages(
  data: ConversationPages | undefined,
  fn: (items: Conversation[]) => Conversation[],
): ConversationPages | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({ ...page, items: fn(page.items) })),
  };
}

export function ConversationsView({ listingId }: { listingId?: number } = {}) {
  const t = useTranslations();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { refresh } = useAuth();
  const [tab, setTab] = useState<TabMode>("inbox");
  const [term, setTerm] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // The Inbox/Archived partition only applies to the full inbox, not the
  // per-listing filtered view (which mirrors mobile's listing-scoped list).
  const archived = !listingId && tab === "archived";
  const queryKey = [
    "conversations",
    listingId ?? "all",
    archived ? "archived" : "inbox",
  ];

  // Rails paginates this index at 20/page. Paging is the ONLY way to reach
  // thread 21+ (mobile infinite-scrolls the same list) — the previous plain
  // useQuery silently truncated the inbox to its first page.
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => getConversations(listingId, archived, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => last.pagination.nextPage ?? undefined,
  });

  const conversations = useMemo<Conversation[]>(
    () => (query.data?.pages ?? []).flatMap((page) => page.items),
    [query.data],
  );

  // Bound to the active locale and passed into the preview helper so an offer
  // row reads "Offer: ؋ ۷۵٬۰۰۰" on /ps — the same locale-formatted price every
  // other surface shows — instead of a raw Latin number.
  const formatCurrency = useCallback(
    (amount: number | null | undefined, currency?: string | null) =>
      formatPrice(amount ?? null, currency ?? null, locale),
    [locale],
  );

  // Client-side search over the LOADED rows (there is no search endpoint):
  // counterpart name, listing title, or the rendered last-message preview.
  const trimmedTerm = term.trim();
  const hasTerm = trimmedTerm.length > 0;
  const rows = useMemo(
    () => filterConversations(conversations, term, t, formatCurrency),
    [conversations, term, t, formatCurrency],
  );

  function clearSearch() {
    setTerm("");
    searchRef.current?.focus();
  }

  // Optimistically drop the row from the current list; on error restore it and
  // toast. Invalidate both partitions so the moved row appears on the other tab.
  const mutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "archive" | "unarchive" }) =>
      action === "archive"
        ? archiveConversation(id)
        : unarchiveConversation(id),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ConversationPages>(queryKey);
      queryClient.setQueryData<ConversationPages>(queryKey, (old) =>
        patchPages(old, (items) => items.filter((c) => c.id !== id)),
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
      const previous = queryClient.getQueryData<ConversationPages>(queryKey);
      queryClient.setQueryData<ConversationPages>(queryKey, (old) =>
        patchPages(old, (items) =>
          items.map((c) =>
            c.id === id ? { ...c, unreadCount: action === "read" ? 0 : 1 } : c,
          ),
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

  // A search box over an inbox that has nothing in it is noise — but keep it
  // mounted while a term is active so the no-match state can still be cleared.
  const showSearch =
    !query.isPending && !query.isError && (conversations.length > 0 || hasTerm);

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

      {/* Find-a-thread search (mobile parity). Render-only: it narrows the
          loaded rows and never touches the unread badges or refetches. */}
      {showSearch && (
        <SearchField
          ref={searchRef}
          containerClassName="mb-4"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onClear={clearSearch}
          placeholder={t("chat.searchPlaceholder")}
          aria-label={t("chat.searchPlaceholder")}
          autoComplete="off"
          data-testid="conversations-search"
        />
      )}

      {query.isError ? (
        <EmptyState
          icon={MessageSquare}
          title={t("common.errorTitle")}
          description={t("common.errorDescription")}
          action={{ label: t("common.retry"), onClick: () => query.refetch() }}
        />
      ) : query.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : conversations.length === 0 ? (
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
        <>
          {rows.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title={t("chat.search.noMatchTitle", { term: trimmedTerm })}
              /* While more pages exist, "no matches" would be misleadingly
                 absolute — the thread may sit on a page nobody has loaded yet,
                 which is also why Load-more stays below this state. */
              description={
                query.hasNextPage
                  ? t("chat.search.noMatchDescriptionPartial")
                  : t("chat.search.noMatchDescription")
              }
              action={{
                label: t("chat.search.clearSearch"),
                onClick: clearSearch,
              }}
            />
          ) : (
            <ul className="divide-y overflow-hidden rounded-lg border bg-card">
              {rows.map((c) => {
                const who = c.otherParticipant;
                const name = who?.name ?? t("chat.unknownUser");
                const unread = (c.unreadCount ?? 0) > 0;
                return (
                  <li key={c.id} className="relative flex items-center">
                    <Link
                      href={`/conversations/${c.id}`}
                      className="flex min-w-0 flex-1 items-center gap-3 p-3 transition-colors hover:bg-accent"
                    >
                      <UserAvatar
                        name={name}
                        avatarUrl={who?.avatarUrl}
                        size={48}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-semibold">
                            {/* Highlight the three fields search matches on, so a
                                filtered row shows WHY it matched — the same
                                treatment as in-thread message search. */}
                            <HighlightedText text={name} query={trimmedTerm} />
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
                          <HighlightedText
                            text={conversationPreviewText(c, t, formatCurrency)}
                            query={trimmedTerm}
                          />
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          <HighlightedText
                            text={c.listing.title}
                            query={trimmedTerm}
                          />
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
                        {/* The shared count pill (see the header's and the owner
                            panel's): this used to be a third hand-rolled span with
                            its own 11px type and its own raw `> 9 ? "9+"`, which
                            printed Latin digits on /ps and /fa. The ring keeps it
                            legible over the thumbnail it is pinned to. */}
                        <CountBadge
                          count={c.unreadCount}
                          label={t("chat.unreadCount", {
                            count: c.unreadCount ?? 0,
                          })}
                          className="absolute -end-1.5 -top-1.5 h-5 min-w-5 border-2 border-card px-1 leading-none"
                        />
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

          {/* Search only sees what's loaded — say so while pages remain, so a
              short result list doesn't read as "that's everything". */}
          {hasTerm && rows.length > 0 && query.hasNextPage && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {t("chat.search.partialResultsConversations")}
            </p>
          )}

          {query.hasNextPage && (
            <Button
              variant="outline"
              className="mx-auto mt-4 flex"
              onClick={() => query.fetchNextPage()}
              disabled={query.isFetchingNextPage}
            >
              {query.isFetchingNextPage && (
                <Loader2 className="size-4 animate-spin" />
              )}
              {t("common.loadMore")}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
