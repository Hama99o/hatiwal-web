"use client";

import { useEffect, useRef } from "react";
import { createConsumer, type Consumer } from "@rails/actioncable";
import { convertKeysToCamel } from "./api/case";
import type { Message } from "./types";

const CABLE_URL =
  process.env.NEXT_PUBLIC_CABLE_URL || "ws://localhost:3098/hatiwal-cable";

/**
 * A single-use ticket for the next connect (POST /api/auth/cable → Rails
 * /cable_ticket). A browser cannot set WebSocket headers, so the URL carries
 * this ticket — worth ONE connect, ~60 s — and never the session itself
 * (privacy review 2026-10-28). Null when signed out or unreachable.
 */
async function fetchCableTicket(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/cable", { method: "POST", cache: "no-store" });
    if (!res.ok) return null;
    const { ticket } = (await res.json()) as { ticket?: unknown };
    return typeof ticket === "string" && ticket ? ticket : null;
  } catch {
    return null;
  }
}

/**
 * A consumer whose every connect carries its own ticket. ActionCable reads
 * `consumer.url` on each (re)open: the URL function hands the current ticket
 * out ONCE (a used ticket is refused), so a reconnect needs `refresh()` first.
 */
function createTicketedConsumer(): { consumer: Consumer; refresh: () => Promise<boolean> } {
  let ticket: string | null = null;
  const consumer = createConsumer(() => {
    const once = ticket;
    ticket = null;
    return `${CABLE_URL}?ticket=${encodeURIComponent(once ?? "")}`;
  });
  const refresh = async () => {
    ticket = await fetchCableTicket();
    return ticket != null;
  };
  return { consumer, refresh };
}

/** Reconnect backoff after a refused connect: 1 s, 2 s, 4 s … 30 s, then stop. */
const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 16000, 30000];

/**
 * Subscribe to a conversation's live message stream. Calls `onMessage` with each
 * new (camelCased) message broadcast over the WebSocket.
 */
export function useConversationCable(
  conversationId: number,
  onMessage: (message: Message) => void,
) {
  const handler = useRef(onMessage);
  handler.current = onMessage;

  useEffect(() => {
    let active = true;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const { consumer, refresh } = createTicketedConsumer();

    void (async () => {
      if (!(await refresh()) || !active) return;
      consumer.subscriptions.create(
        { channel: "ConversationChannel", conversation_id: conversationId },
        {
          connected() {
            failures = 0;
          },
          // Every next connect needs a fresh ticket. A dropped network: ActionCable
          // reopens by itself shortly, and the ticket is usually there by then. A
          // refused connect (a stale ticket): it does not, so we connect once the new
          // ticket is in — with a backoff, and never while signed out.
          disconnected(data?: { willAttemptReconnect?: boolean }) {
            if (!active) return;
            const reconnectsItself = data?.willAttemptReconnect ?? false;
            void refresh().then((ok) => {
              if (!active || !ok || reconnectsItself) return;
              const delay = RECONNECT_DELAYS_MS[failures];
              if (delay === undefined) return;
              failures += 1;
              timer = setTimeout(() => active && consumer.connect(), delay);
            });
          },
          received(data: { message?: unknown }) {
            if (data?.message) {
              handler.current(convertKeysToCamel<Message>(data.message));
            }
          },
        },
      );
    })();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      consumer.disconnect();
    };
  }, [conversationId]);
}
