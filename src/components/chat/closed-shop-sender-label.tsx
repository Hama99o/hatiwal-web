"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { userTextProps } from "@/lib/text-direction";
import type { Message } from "@/lib/types";

/**
 * closed-shop-face (api a3ca16b): when a shop closes, its product chats go back
 * to the owner, but what the team wrote AS the shop before the closure stays
 * the shop's — `sender.shopClosed`, the shop's name, no logo, and no member id
 * for the buyer. In such a chat each run on the other side opens with who
 * wrote it: the shop's name + a quiet "Closed" marker and a neutral shop square
 * for the old messages, the owner's own name + avatar for the newer ones. So
 * the buyer never reads a member's personal name on the shop's messages, and
 * sees why the later ones carry the owner's.
 *
 * `justify-start` is the other side and mirrors with `dir="rtl"` (ps/fa/ur).
 */
export function ClosedShopSenderLabel({ sender }: { sender: Message["sender"] }) {
  const t = useTranslations("chat.closedShop");
  const shop = !!sender.shopClosed;
  return (
    <div
      className="mt-3 flex justify-start"
      data-testid={shop ? "message-closed-shop-sender" : "message-personal-sender"}
    >
      <div className="flex max-w-[80%] items-center gap-1.5">
        {shop ? (
          <UserAvatar variant="shopClosed" name={sender.name} size={18} />
        ) : (
          <UserAvatar name={sender.name} avatarUrl={sender.avatarUrl} size={18} />
        )}
        <span
          className="truncate text-xs font-semibold text-muted-foreground"
          data-testid={shop ? "message-closed-shop-name" : "message-personal-sender-name"}
          {...userTextProps(sender.name)}
        >
          {sender.name}
        </span>
        {shop && (
          <Badge variant="muted" className="shrink-0 px-1.5 py-0 text-[10.5px]" data-testid="message-closed-shop-badge">
            {t("badge")}
          </Badge>
        )}
      </div>
    </div>
  );
}

/**
 * Opens a run on the other side of a closed shop's chat: the first message of
 * the day, after the viewer's side or a system notice, or where the face
 * changes (the shop's → the owner's own). `mine` tells the viewer's side.
 */
export function startsClosedShopRun(
  messages: Message[],
  index: number,
  newDay: boolean,
  mine: (m: Message) => boolean,
): boolean {
  const m = messages[index];
  if (!m || mine(m) || m.kind === "system") return false;
  const prev = index > 0 ? messages[index - 1] : null;
  return (
    newDay ||
    !prev ||
    mine(prev) ||
    prev.kind === "system" ||
    !!prev.sender.shopClosed !== !!m.sender.shopClosed
  );
}
