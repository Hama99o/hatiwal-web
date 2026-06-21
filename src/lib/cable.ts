"use client";

import { useEffect, useRef } from "react";
import { createConsumer, type Consumer } from "@rails/actioncable";
import { convertKeysToCamel } from "./api/case";
import type { Message } from "./types";

const CABLE_URL =
  process.env.NEXT_PUBLIC_CABLE_URL || "ws://localhost:3098/hatiwal-cable";

/**
 * Build an ActionCable consumer, authed via the devise token (fetched from our
 * server endpoint since it's in httpOnly cookies). Returns null if not signed in.
 */
async function createCableConsumer(): Promise<Consumer | null> {
  const res = await fetch("/api/auth/cable", { cache: "no-store" });
  if (!res.ok) return null;
  const { accessToken, client, uid } = await res.json();
  if (!accessToken) return null;
  const url =
    `${CABLE_URL}?access_token=${encodeURIComponent(accessToken)}` +
    `&client=${encodeURIComponent(client)}&uid=${encodeURIComponent(uid)}`;
  return createConsumer(url);
}

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
    let consumer: Consumer | null = null;

    void (async () => {
      const c = await createCableConsumer();
      if (!c) return;
      if (!active) {
        c.disconnect();
        return;
      }
      consumer = c;
      consumer.subscriptions.create(
        { channel: "ConversationChannel", conversation_id: conversationId },
        {
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
      consumer?.disconnect();
    };
  }, [conversationId]);
}
