"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useSellingIdentity } from "./use-selling-identity";

const askedKey = (userId: number) => `hatiwal.sell-as-asked-${userId}`;

function UnreadDot({ count }: { count: number | null }) {
  if (!count) return null;
  return (
    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold text-destructive-foreground">
      {count > 99 ? "99+" : count}
    </span>
  );
}

/**
 * SHOP-1 "Selling as" pill + sheet in the seller header (/my-listings, chats),
 * same as mobile's SellingAsPill: renders NOTHING without a shop, opens the
 * "Sell as" dialog once by itself, shows unread for the identities you are not
 * in. testids mirror mobile (selling-as-pill, sell-as-sheet, sell-as-option-*).
 */
export function SellingAsPill() {
  const t = useTranslations("shops");
  const { user } = useAuth();
  const { sellingAs, shops, hasShop, unreadFor, switchTo, switching } = useSellingIdentity();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<number | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!hasShop || !user) return;
    try {
      if (!window.localStorage.getItem(askedKey(user.id))) {
        window.localStorage.setItem(askedKey(user.id), "1");
        setChoice(sellingAs?.id ?? null);
        setOpen(true);
      }
    } catch {
      /* storage unavailable: just don't auto-open */
    }
  }, [hasShop, user, sellingAs?.id]);

  if (!hasShop || !user) return null;

  const meName = user.fullName || `${user.firstname} ${user.lastname}`.trim();
  const current = sellingAs?.id ?? null;
  const otherUnread = [null, ...shops.map((s) => s.id)]
    .filter((id) => id !== current)
    .reduce<number>((sum, id) => sum + (unreadFor(id) ?? 0), 0);
  const options = [
    { id: null as number | null, name: `${t("me")} · ${meName}`, logo: user.avatarUrl, shop: false },
    ...shops.map((s) => ({ id: s.id as number | null, name: s.name, logo: s.logoUrl, shop: true })),
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setChoice(current);
          setOpen(true);
        }}
        data-testid="selling-as-pill"
        aria-label={t("sellingAs", { name: sellingAs?.name ?? meName })}
        className="inline-flex items-center gap-2 rounded-full border bg-card px-2.5 py-1.5 text-sm font-semibold transition-colors hover:bg-accent"
      >
        <UserAvatar variant={sellingAs ? "shop" : "user"} name={sellingAs?.name ?? meName} avatarUrl={sellingAs ? sellingAs.logoUrl : user.avatarUrl} size={24} />
        {t("sellingAs", { name: sellingAs ? sellingAs.name : t("me") })}
        <ChevronDown className="size-3.5 text-muted-foreground" />
        <UnreadDot count={otherUnread} />
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} labelledBy={titleId} className="max-w-md">
        <div className="space-y-2 p-5" data-testid="sell-as-sheet">
          <h2 id={titleId} className="mb-2 text-lg font-extrabold">
            {t("sellAs")}
          </h2>
          <div role="radiogroup" className="space-y-2">
            {options.map((o) => {
              const selected = choice === o.id;
              return (
                <button
                  key={String(o.id)}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setChoice(o.id)}
                  data-testid={o.id === null ? "sell-as-option-me" : `sell-as-option-shop-${o.id}`}
                  className={cn("flex w-full items-center gap-3 rounded-xl border p-3 text-start transition-colors hover:bg-accent", selected && "border-2 border-primary")}
                >
                  <UserAvatar variant={o.shop ? "shop" : "user"} name={o.name} avatarUrl={o.logo} size={36} />
                  <span className="flex-1 truncate font-semibold">{o.name}</span>
                  <UnreadDot count={unreadFor(o.id)} />
                  {selected && <Check className="size-4 text-primary" />}
                </button>
              );
            })}
          </div>
          <Button
            className="mt-3 w-full"
            disabled={switching}
            onClick={() => {
              switchTo(choice);
              setOpen(false);
            }}
            data-testid="sell-as-continue"
          >
            {t("continue")}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
