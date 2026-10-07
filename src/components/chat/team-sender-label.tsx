"use client";

import { useTranslations } from "next-intl";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { Message } from "@/lib/types";

/**
 * Owner, 2026-10-12 (docs/OWNER_ITEMS_2026-10-12.md, item 7): in a shop's chat
 * (and a shop's Support thread) the team SEES CLEARLY which member sent each
 * message. Shown once above the first bubble of each member's run on the
 * team's side: the member's name ("You" for the viewer's own) + an initials
 * avatar — the web twin of mobile's TeamSenderLabel (Mobbin check:
 * hatiwal-mobile docs/design/TEAM_REPLIES.md).
 *
 * Members only: `sentBy` never reaches the buyer, who still sees only the shop.
 * `justify-end` is the team's side and mirrors with `dir="rtl"` (ps/fa), like
 * the team's bubbles; so does the row order, keeping the avatar on the outer edge.
 */
export function TeamSenderLabel({ name, isMe }: { name: string; isMe: boolean }) {
  const t = useTranslations();
  const label = isMe ? t("chat.thread.you") : name;
  return (
    <div className="mt-3 flex justify-end" data-testid="message-team-sender">
      <div className="flex max-w-[80%] items-center gap-1.5">
        <span
          className={isMe ? "truncate text-xs font-semibold text-primary" : "truncate text-xs font-semibold text-muted-foreground"}
          data-testid={isMe ? "message-team-sender-you" : "message-team-sender-name"}
        >
          {label}
        </span>
        <UserAvatar name={name} size={18} />
      </div>
    </div>
  );
}

/** Opens a run of one member's team messages (the label shows once per run). */
export function startsTeamRun(messages: Message[], index: number, newDay: boolean): boolean {
  const m = messages[index];
  if (!m?.sentBy) return false;
  const prev = index > 0 ? messages[index - 1] : null;
  return newDay || !prev?.sentBy || prev.sentBy.id !== m.sentBy.id;
}
