"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowLeftRight,
  CalendarPlus,
  Loader2,
  Paperclip,
  Search,
  Send,
  ShieldBan,
  ShieldCheck,
  X,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import {
  blockUser,
  deleteMessage,
  getConversation,
  getMessages,
  markRead,
  sendFile,
  sendMessage,
  unblockUser,
} from "@/lib/api/chat";
import { useConversationCable } from "@/lib/cable";
import type { Message, Transaction } from "@/lib/types";
import { UserIdentity } from "@/components/shared/user-identity";
import { ReportButton } from "@/components/shared/report-button";
import { SafetyTips } from "@/components/shared/safety-tips";
import { ReviewPromptDialog } from "@/components/shared/review-prompt-dialog";
import {
  LifecycleDialogs,
  useListingLifecycle,
} from "@/components/account/listing-actions";
import { RemoteImage } from "@/components/shared/remote-image";
import { PriceTag } from "@/components/shared/price-tag";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { MessageBubble } from "./message-bubble";
import { QuickReplies } from "./quick-replies";
import { useComposerDraft } from "./use-composer-draft";
import { filterMessages, searchableCount } from "@/lib/message-search";
import { dayKey } from "@/lib/message-days";
import { formatDate, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ListingStatus } from "@/lib/types";

export function ConversationThread({ id }: { id: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const qc = useQueryClient();
  const meetupTitleId = useId();
  const counterTitleId = useId();
  const { user, refresh } = useAuth();
  const me = user?.id;
  const cid = Number(id);

  const convQ = useQuery({
    queryKey: ["conversation", id],
    queryFn: () => getConversation(id),
  });
  const msgsQ = useQuery({
    queryKey: ["messages", id],
    queryFn: () => getMessages(id),
  });

  const [messages, setMessages] = useState<Message[]>([]);
  // Composer text persisted per conversation (mirrors mobile's
  // useComposerDraft) so an unsent draft survives navigation and reload.
  // Disabled (null id) while the conversation is loading and for a closed
  // conversation — a closed thread has no composer and must never persist.
  const draftEnabled =
    convQ.data != null && convQ.data.status !== "closed";
  const {
    draft: input,
    setDraft: setInput,
    clearDraft,
  } = useComposerDraft(draftEnabled ? cid : null);
  const [sending, setSending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [meetupOpen, setMeetupOpen] = useState(false);
  const [place, setPlace] = useState("");
  const [time, setTime] = useState("");
  // Counter-offer dialog (seller responds to the buyer's offer with a new price).
  const [counterTarget, setCounterTarget] = useState<Message | null>(null);
  const [counterAmount, setCounterAmount] = useState("");
  const [sendingCounter, setSendingCounter] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Seller lifecycle from the pinned listing header: reserve/mark-sold → buyer
  // picker → (on sold) review prompt. Mirrors mobile's ListingHeader. The
  // transitions, prompts, toasts and invalidation come from the shared brain
  // (account/listing-actions) — the same one the /my-listings cards and the
  // owner detail screen use, so the three surfaces can never disagree.
  const [reviewTxn, setReviewTxn] = useState<Transaction | null>(null);
  const lifecycle = useListingLifecycle(convQ.data?.listing?.id ?? 0, {
    title: convQ.data?.listing?.title,
    // ConversationSerializer's nested listing carries availableUnits (added for
    // the "each" price suffix), so the thread's own reserve/sold flow can ask
    // "how many did you sell?" too — the seller often closes the deal here.
    remainingQuantity: convQ.data?.listing?.availableUnits,
    onSaleRecorded: setReviewTxn,
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Seed/re-seed from the fetched list. The fetch is authoritative for every
  // message it contains (it carries the freshest readAt — that's how a sent tick
  // becomes a seen tick), but anything sent/received locally that the response
  // predates is appended, never dropped: a refetch racing a send would otherwise
  // make the just-sent message vanish. Returning `fetched` unchanged when there
  // is nothing local keeps the reference stable against the cache-sync effect
  // below (same ref → React bails out → no loop).
  useEffect(() => {
    const fetched = msgsQ.data;
    if (!fetched) return;
    setMessages((prev) => {
      if (prev.length === 0) return fetched;
      const fetchedIds = new Set(fetched.map((m) => m.id));
      const localOnly = prev.filter((m) => !fetchedIds.has(m.id));
      return localOnly.length ? [...fetched, ...localOnly] : fetched;
    });
  }, [msgsQ.data]);
  // Keep the ["messages", id] cache in step with the local list. Sends and live
  // cable messages only update local state; without this, leaving and returning
  // to the thread within the 60s staleTime re-seeds from the STALE fetched list
  // and drops everything sent/received during the visit. Syncing the cache (same
  // ref → no seed-effect re-run, no loop) means the remount re-seeds from the
  // latest. Skip the empty initial state so we never clobber a real cached list.
  useEffect(() => {
    if (messages.length) qc.setQueryData(["messages", id], messages);
  }, [messages, id, qc]);
  // Adopt the server's block state when the SERVER's answer changes, not on
  // every response object. A response that merely repeats what it said last
  // time must not overwrite a local flip: blocking (from the shield or from the
  // report follow-up) refetches this conversation, and a payload that predates
  // the block — or a background refetch that was already in flight — would
  // otherwise snap the shield straight back to "Block" while the block stands.
  const serverBlocked = useRef<boolean | null>(null);
  useEffect(() => {
    if (!convQ.data) return;
    const next = Boolean(convQ.data.blockedWithParticipant);
    if (serverBlocked.current === next) return;
    serverBlocked.current = next;
    setBlocked(next);
  }, [convQ.data]);
  useEffect(() => {
    // Opening a thread marks it read. Refresh the auth user too so the header's
    // aggregate unread badge (user.unreadMessageCount) updates — invalidating
    // the conversations list alone leaves the header badge stale.
    markRead(cid)
      .then(() => refresh())
      .catch(() => undefined);
    qc.invalidateQueries({ queryKey: ["conversations"] });
  }, [cid, qc, refresh]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Live updates over the WebSocket. Upsert by id so a re-broadcast of an
  // existing message (e.g. a soft-delete tombstone flip) replaces it in place
  // rather than being ignored as a duplicate.
  useConversationCable(cid, (m) => {
    setMessages((prev) => {
      const idx = prev.findIndex((x) => x.id === m.id);
      if (idx === -1) return [...prev, m];
      const next = prev.slice();
      next[idx] = m;
      return next;
    });
    markRead(cid).catch(() => undefined);
  });

  // Retract (soft-delete) one of my own messages: optimistic tombstone flip,
  // roll back the original message on failure.
  async function doDelete(messageId: number) {
    setConfirmDeleteId(null);
    const original = messages.find((x) => x.id === messageId);
    setMessages((prev) =>
      prev.map((x) =>
        x.id === messageId
          ? { ...x, deleted: true, body: "", attachmentUrl: null }
          : x,
      ),
    );
    try {
      const updated = await deleteMessage(cid, messageId);
      setMessages((prev) =>
        prev.map((x) => (x.id === messageId ? updated : x)),
      );
      qc.invalidateQueries({ queryKey: ["messages", id] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    } catch {
      if (original) {
        setMessages((prev) =>
          prev.map((x) => (x.id === messageId ? original : x)),
        );
      }
      toast.error(t("chat.message.deleteFailed"));
    }
  }

  const respondedIds = useMemo(
    () => new Set(messages.map((m) => m.respondsToId).filter(Boolean)),
    [messages],
  );

  // In-thread search (client-side only) — filters the loaded messages by the
  // typed query. Outcome lookups (respondedIds) stay on the full list.
  const trimmedQuery = searchQuery.trim();
  const searching = searchOpen && trimmedQuery.length > 0;
  const visibleMessages = useMemo(
    () => (searching ? filterMessages(messages, trimmedQuery) : messages),
    [searching, messages, trimmedQuery],
  );
  const totalSearchable = useMemo(
    () => searchableCount(messages),
    [messages],
  );

  // Day separators: a centred chip before the first message of each new local
  // calendar day, labelled Today/Yesterday when it lands on one. Suppressed
  // while searching — filtered results are not contiguous days, so a separator
  // between two matches would claim a day boundary that isn't there.
  //
  // Deliberate divergence from mobile (do not "fix" to match it): mobile's
  // `buildThreadRows` also emits a day row ABOVE the very first message, so a
  // single-day thread there carries one chip. Web renders separators only at a
  // real day *boundary* (hence the `prev != null` guard below) — a single-day
  // thread gets none. The chip earns its space by marking a gap in time; on the
  // web thread, where the pinned listing header already sits directly above the
  // first bubble, a leading chip only pushes the conversation down. This is the
  // behaviour TASK-WEB-D2READ acceptance #4 specifies.
  const todayKey = dayKey(new Date().toISOString());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = dayKey(yesterday.toISOString());

  function dayLabel(key: string, isoDate: string): string {
    if (key === todayKey) return t("chat.day.today");
    if (key === yesterdayKey) return t("chat.day.yesterday");
    return formatDate(isoDate, locale);
  }

  function closeSearch() {
    setSearchOpen(false);
    setSearchQuery("");
  }

  // Insert a quick-reply phrase into the draft (append with a space if the
  // draft is non-empty, mirroring mobile) and focus the input — no auto-send.
  function handleQuickReply(phrase: string) {
    const trimmed = input.trimEnd();
    setInput(trimmed.length > 0 ? `${trimmed} ${phrase}` : phrase);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  const conversation = convQ.data;
  const other = conversation?.otherParticipant;
  const closed = conversation?.status === "closed";
  // The seller (listing owner) is the one who can counter a buyer's offer.
  const isSeller = conversation?.seller?.id != null && conversation.seller.id === me;

  async function send(
    body: string,
    kind: Message["kind"] = "text",
    respondsToId?: number,
  ) {
    if (kind === "text" && !body.trim()) return;
    setSending(true);
    try {
      const m = await sendMessage(cid, body, kind, respondsToId);
      setMessages((prev) =>
        prev.some((x) => x.id === m.id) ? prev : [...prev, m],
      );
      if (kind === "text") {
        // Successful send — wipe the persisted draft too. A failed send
        // (catch below) keeps both the input and the stored draft intact.
        clearDraft();
        setInput("");
      }
    } catch {
      toast.error(t("chat.thread.sendFailed"));
    } finally {
      setSending(false);
    }
  }

  async function sendAttachment(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t("chat.thread.sendFailed"));
      return;
    }
    setUploading(true);
    try {
      const m = await sendFile(cid, file);
      setMessages((prev) =>
        prev.some((x) => x.id === m.id) ? prev : [...prev, m],
      );
    } catch {
      toast.error(t("chat.thread.sendFailed"));
    } finally {
      setUploading(false);
    }
  }

  function proposeMeetup() {
    if (!place.trim()) return toast.error(t("chat.meetup.placeRequired"));
    if (!time.trim()) return toast.error(t("chat.meetup.timeRequired"));
    send(`${place.trim()} | ${time.trim()}`, "meetup_proposal");
    setMeetupOpen(false);
    setPlace("");
    setTime("");
    toast.success(t("chat.thread.meetupSent"));
  }

  // Open the counter-offer dialog, seeded with the buyer's offer amount.
  function openCounter(offer: Message) {
    const buyerAmount = offer.offerAmount ?? Number(offer.body.split("|")[0] ?? 0);
    setCounterTarget(offer);
    setCounterAmount(buyerAmount > 0 ? String(buyerAmount) : "");
  }

  function closeCounter() {
    setCounterTarget(null);
    setCounterAmount("");
  }

  // Send the counter-offer as an `offer_counter` message that responds to the
  // buyer's original offer. Body reuses the same "amount|currency|listedPrice"
  // encoding as a regular offer so both clients render it identically.
  async function sendCounter() {
    if (!counterTarget) return;
    const amount = counterAmount.trim();
    if (!amount || Number(amount) <= 0) return;
    const [, currencyPart, listedPart] = counterTarget.body.split("|");
    const currency = counterTarget.offerCurrency || currencyPart || "AFN";
    const body = `${amount}|${currency}|${listedPart ?? "0"}`;
    setSendingCounter(true);
    try {
      const m = await sendMessage(cid, body, "offer_counter", counterTarget.id);
      setMessages((prev) =>
        prev.some((x) => x.id === m.id) ? prev : [...prev, m],
      );
      closeCounter();
      toast.success(t("chat.offer.counterSentToast"));
    } catch {
      toast.error(t("chat.thread.sendFailed"));
    } finally {
      setSendingCounter(false);
    }
  }

  async function toggleBlock() {
    setConfirmBlock(false);
    try {
      if (blocked) {
        if (other) await unblockUser(other.id);
        setBlocked(false);
        toast.success(t("chat.block.unblockSuccess"));
      } else {
        if (other) await blockUser(other.id);
        setBlocked(true);
        toast.success(t("chat.block.blockSuccess"));
      }
      // The blocked-users list is the shared source of truth for "have I blocked
      // this person" — the setting page renders it and ReportButton asks it
      // whether to offer its block follow-up. Left stale for its 60s window it
      // would offer to block someone this header just blocked.
      qc.invalidateQueries({ queryKey: ["blocked-users"] });
    } catch {
      toast.error(t("common.error"));
    }
  }

  if (convQ.isPending || msgsQ.isPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  // Gate on the messages query too: if the conversation loads but messages fail,
  // rendering an empty thread would read as "no messages yet" (a false empty)
  // rather than a load error.
  if (convQ.isError || msgsQ.isError || !conversation) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center text-muted-foreground">
        {t("chat.thread.loadFailed")}
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-3xl flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link href="/conversations" aria-label={t("common.back")}>
            <ArrowLeft className="size-5 rtl:-scale-x-100" />
          </Link>
        </Button>
        {other && (
          <UserIdentity
            name={other.name}
            avatarUrl={other.avatarUrl}
            verified={other.verified}
            subtitle={other.city}
            href={`/sellers/${other.id}`}
            size={40}
            className="min-w-0 flex-1"
          />
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn("shrink-0", searchOpen && "text-primary")}
          aria-label={t("chat.search.placeholder")}
          onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
        >
          <Search className="size-5" />
        </Button>
        {other && (
          <ReportButton
            reportableType="User"
            reportableId={other.id}
            className="size-10 shrink-0 justify-center gap-0 rounded-md hover:bg-accent [&>span]:sr-only"
            // Flip this header's own shield the moment the report→block
            // follow-up succeeds, without waiting for the refetch it triggers.
            // Whether the prompt is offered at all is NOT ours to answer:
            // `blocked` here also means "they blocked me" (Rails ORs both
            // directions), and reading that as "already blocked" would deny the
            // person being harassed the block. ReportButton asks
            // `["blocked-users"]` — the people *I* blocked — instead.
            onBlocked={() => setBlocked(true)}
          />
        )}
        <Button
          variant="ghost"
          size="icon"
          className={blocked ? "text-destructive" : ""}
          aria-label={t(blocked ? "chat.block.unblockUser" : "chat.block.blockUser")}
          onClick={() => setConfirmBlock(true)}
        >
          {blocked ? (
            <ShieldCheck className="size-5" />
          ) : (
            <ShieldBan className="size-5" />
          )}
        </Button>
      </div>

      {/* In-thread search (client-side only) */}
      {searchOpen && (
        <div className="flex items-center gap-2 border-b bg-card px-3 py-2">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("chat.search.placeholder")}
            aria-label={t("chat.search.placeholder")}
            className="h-9 flex-1 text-start"
          />
          {trimmedQuery && (
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {t("chat.search.matchCount", {
                current: visibleMessages.length,
                total: totalSearchable,
              })}
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label={t("common.cancel")}
            onClick={closeSearch}
          >
            <X className="size-4" />
          </Button>
        </div>
      )}
      {searching && (
        <div className="border-b bg-muted/40 px-3 py-1 text-center text-xs text-muted-foreground">
          {t("chat.search.partialResults")}
        </div>
      )}

      {/* Pinned listing */}
      <Link
        href={`/listings/${conversation.listing.id}`}
        className="flex items-center gap-3 border-b bg-card/50 px-3 py-2 transition-colors hover:bg-accent"
      >
        <div className="size-10 shrink-0 overflow-hidden rounded-md bg-muted">
          <RemoteImage
            src={conversation.listing.thumbnailUrl}
            alt={conversation.listing.title}
            width={40}
            height={40}
            className="size-10 object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {conversation.listing.title}
          </p>
          {conversation.listing.price != null && (
            <PriceTag
              price={conversation.listing.price}
              currency={conversation.listing.currency}
              size="sm"
            />
          )}
        </div>
        <StatusBadge status={conversation.listing.status as ListingStatus} />
      </Link>

      {/* Seller lifecycle from the pinned header (owner only): reserve an active
          listing or mark a reserved one sold — opens the buyer picker. */}
      {isSeller &&
        (conversation.listing.status === "active" ||
          conversation.listing.status === "reserved") && (
          <div className="border-b bg-card/50 px-3 pb-2">
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={lifecycle.busy}
              onClick={() =>
                lifecycle.ask(
                  conversation.listing.status === "reserved"
                    ? "sold"
                    : "reserve",
                )
              }
            >
              {t(
                conversation.listing.status === "reserved"
                  ? "listing.markSold"
                  : "listing.markReserved",
              )}
            </Button>
          </div>
        )}

      {/* Messages */}
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t("chat.thread.emptyDescription")}
          </p>
        ) : searching && visibleMessages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t("chat.search.noResults")}
          </p>
        ) : (
          visibleMessages.map((m, i) => {
            const key = dayKey(m.createdAt);
            const prev = i > 0 ? visibleMessages[i - 1] : null;
            const showDay =
              !searching && prev != null && dayKey(prev.createdAt) !== key;
            return (
              <Fragment key={m.id}>
                {showDay && (
                  <div
                    className="my-2 flex justify-center"
                    data-testid="day-separator"
                  >
                    <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                      {dayLabel(key, m.createdAt)}
                    </span>
                  </div>
                )}
                <MessageBubble
                  message={m}
                  mine={m.sender.id === me}
                  responded={respondedIds.has(m.id)}
                  highlight={searching ? trimmedQuery : undefined}
                  onCounter={
                    m.kind === "offer" &&
                    m.sender.id !== me &&
                    isSeller &&
                    !respondedIds.has(m.id)
                      ? () => openCounter(m)
                      : undefined
                  }
                  onDelete={
                    m.sender.id === me && !m.deleted && m.kind !== "system"
                      ? () => setConfirmDeleteId(m.id)
                      : undefined
                  }
                  onRespond={(kind, respondsToId) => {
                    // Rails requires a non-empty body; the bubble renders by `kind`.
                    const label = {
                      meetup_accepted: t("chat.meetup.accepted"),
                      meetup_declined: t("chat.meetup.declined"),
                      offer_accepted: t("chat.offer.accepted"),
                      offer_declined: t("chat.offer.declined"),
                    }[kind];
                    send(label, kind, respondsToId);
                  }}
                />
              </Fragment>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick-reply preset chips (hidden on a closed conversation) */}
      {!closed && (
        <QuickReplies
          role={isSeller ? "seller" : "buyer"}
          onSelect={handleQuickReply}
        />
      )}

      {/* Composer */}
      {closed ? (
        <div className="border-t p-4 text-center text-sm text-muted-foreground">
          {t("chat.thread.closedInput")}
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2 border-t p-3"
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.txt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) sendAttachment(f);
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-label={t("chat.attachFile")}
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Paperclip className="size-5" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-label={t("chat.proposeMeetup")}
            onClick={() => setMeetupOpen(true)}
          >
            <CalendarPlus className="size-5" />
          </Button>
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("chat.messagePlaceholder")}
            aria-label={t("chat.messagePlaceholder")}
          />
          <Button
            type="submit"
            size="icon"
            className="shrink-0"
            disabled={sending || !input.trim()}
            aria-label={t("chat.send")}
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4 rtl:-scale-x-100" />
            )}
          </Button>
        </form>
      )}

      {/* Meetup dialog */}
      <Dialog
        open={meetupOpen}
        onClose={() => setMeetupOpen(false)}
        labelledBy={meetupTitleId}
        className="max-w-sm space-y-4"
      >
        <h2 id={meetupTitleId} className="text-lg font-semibold">
          {t("chat.meetup.title")}
        </h2>
        <Input
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          placeholder={t("chat.meetup.placePlaceholder")}
        />
        <Input
          value={time}
          onChange={(e) => setTime(e.target.value)}
          placeholder={t("chat.meetup.timePlaceholder")}
        />
        {/* Remind buyers/sellers to meet safely when arranging a meetup. */}
        <SafetyTips variant="short" />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setMeetupOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={proposeMeetup}>{t("chat.meetup.propose")}</Button>
        </div>
      </Dialog>

      {/* Counter-offer dialog (seller) */}
      <Dialog
        open={counterTarget != null}
        onClose={closeCounter}
        labelledBy={counterTitleId}
        dismissible={!sendingCounter}
        className="max-w-sm space-y-4"
      >
        {counterTarget && (
          <>
            <h2
              id={counterTitleId}
              className="flex items-center gap-2 text-lg font-semibold"
            >
              <ArrowLeftRight className="size-5 text-brand-gold" />
              {t("chat.offer.counterTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("chat.offer.buyerOfferedAt", {
                price: formatPrice(
                  counterTarget.offerAmount ??
                    Number(counterTarget.body.split("|")[0] ?? 0),
                  counterTarget.offerCurrency ||
                    counterTarget.body.split("|")[1] ||
                    "AFN",
                  locale,
                ),
              })}
            </p>
            <div>
              <label
                htmlFor="counter-amount"
                className="mb-1.5 block text-sm font-medium"
              >
                {t("chat.offer.yourCounterOffer")}
              </label>
              <Input
                id="counter-amount"
                type="number"
                inputMode="numeric"
                min={1}
                autoFocus
                value={counterAmount}
                onChange={(e) => setCounterAmount(e.target.value)}
                placeholder="0"
                className="text-start"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("chat.offer.counterNote")}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeCounter}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={sendCounter}
                disabled={
                  sendingCounter ||
                  !counterAmount.trim() ||
                  Number(counterAmount) <= 0
                }
              >
                {sendingCounter ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  t("chat.offer.sendCounter")
                )}
              </Button>
            </div>
          </>
        )}
      </Dialog>

      {/* Seller: pick the buyer to reserve/mark-sold, then (on sold) review.
          The picker, its copy and the mutation are the shared lifecycle brain's
          — this surface only decides WHICH transition to offer. */}
      <LifecycleDialogs lifecycle={lifecycle} />
      {reviewTxn && (
        <ReviewPromptDialog
          transaction={reviewTxn}
          role="seller"
          onClose={() => setReviewTxn(null)}
        />
      )}

      <ConfirmDialog
        open={confirmBlock}
        title={t(blocked ? "chat.block.unblockUser" : "chat.block.blockConfirmTitle")}
        description={blocked ? undefined : t("chat.block.blockConfirmDescription")}
        confirmLabel={t(blocked ? "chat.block.unblockUser" : "chat.block.blockUser")}
        cancelLabel={t("common.cancel")}
        destructive={!blocked}
        onConfirm={toggleBlock}
        onCancel={() => setConfirmBlock(false)}
      />

      <ConfirmDialog
        open={confirmDeleteId != null}
        title={t("chat.message.deleteConfirm")}
        description={t("chat.message.deleteConfirmDescription")}
        confirmLabel={t("chat.message.deleteConfirmCta")}
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={() => {
          if (confirmDeleteId != null) doDelete(confirmDeleteId);
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
