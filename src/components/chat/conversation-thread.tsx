"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarPlus,
  Loader2,
  Paperclip,
  Send,
  ShieldBan,
  ShieldCheck,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import {
  blockUser,
  getConversation,
  getMessages,
  markRead,
  sendFile,
  sendMessage,
  unblockUser,
} from "@/lib/api/chat";
import { useConversationCable } from "@/lib/cable";
import type { Message } from "@/lib/types";
import { UserIdentity } from "@/components/shared/user-identity";
import { RemoteImage } from "@/components/shared/remote-image";
import { PriceTag } from "@/components/shared/price-tag";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { MessageBubble } from "./message-bubble";
import type { ListingStatus } from "@/lib/types";

export function ConversationThread({ id }: { id: string }) {
  const t = useTranslations();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
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
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [meetupOpen, setMeetupOpen] = useState(false);
  const [place, setPlace] = useState("");
  const [time, setTime] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (msgsQ.data) setMessages(msgsQ.data);
  }, [msgsQ.data]);
  useEffect(() => {
    if (convQ.data) setBlocked(Boolean(convQ.data.blockedWithParticipant));
  }, [convQ.data]);
  useEffect(() => {
    markRead(cid).catch(() => undefined);
    qc.invalidateQueries({ queryKey: ["conversations"] });
  }, [cid, qc]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Live updates over the WebSocket.
  useConversationCable(cid, (m) => {
    setMessages((prev) =>
      prev.some((x) => x.id === m.id) ? prev : [...prev, m],
    );
    markRead(cid).catch(() => undefined);
  });

  const respondedIds = useMemo(
    () => new Set(messages.map((m) => m.respondsToId).filter(Boolean)),
    [messages],
  );

  const conversation = convQ.data;
  const other = conversation?.otherParticipant;
  const closed = conversation?.status === "closed";

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
      if (kind === "text") setInput("");
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
  if (convQ.isError || !conversation) {
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
          <Link href="/conversations" aria-label="Back">
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

      {/* Messages */}
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t("chat.thread.emptyDescription")}
          </p>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              mine={m.sender.id === me}
              responded={respondedIds.has(m.id)}
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
          ))
        )}
        <div ref={bottomRef} />
      </div>

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
      {meetupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMeetupOpen(false)}
          />
          <div className="relative z-10 w-full max-w-sm space-y-4 rounded-lg border bg-card p-6 shadow-lg">
            <h2 className="text-lg font-semibold">{t("chat.meetup.title")}</h2>
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
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMeetupOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={proposeMeetup}>{t("chat.meetup.propose")}</Button>
            </div>
          </div>
        </div>
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
    </div>
  );
}
