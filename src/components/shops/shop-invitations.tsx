"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { UserAvatar } from "@/components/shared/user-avatar";
import { VerifiedBadge } from "@/components/shared/verified-badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { MyShopInvite } from "@/lib/api/shop-team";
import { useShopInvitations } from "./use-shop-invitations";

const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));

/**
 * Accept / Decline for one invitation, Decline asking first. Shared by the
 * Profile card and the compact row (Selling-as menu, no-shop dialog).
 */
function Actions({ invite, size }: { invite: MyShopInvite; size: "sm" | "default" }) {
  const t = useTranslations("shops");
  const tc = useTranslations("common");
  const { accept, decline } = useShopInvitations();
  const [asking, setAsking] = useState(false);
  const busy = accept.isPending || decline.isPending;
  return (
    <>
      <div className="flex gap-2">
        <Button size={size} onClick={() => accept.mutate(invite)} disabled={busy} data-testid={`shop-invitation-accept-${invite.id}`}>
          {t("invitations.accept")}
        </Button>
        <Button size={size} variant="outline" onClick={() => setAsking(true)} disabled={busy} data-testid={`shop-invitation-decline-${invite.id}`}>
          {t("invitations.decline")}
        </Button>
      </div>
      <ConfirmDialog
        open={asking}
        title={t("invitations.declineTitle", { shop: invite.shop.name })}
        description={t("invitations.declineBody")}
        confirmLabel={t("invitations.decline")}
        cancelLabel={tc("cancel")}
        destructive
        loading={decline.isPending}
        onConfirm={() => decline.mutate(invite, { onSettled: () => setAsking(false) })}
        onCancel={() => setAsking(false)}
      />
    </>
  );
}

/** Profile, both modes, above "My shops": one card per pending invitation. */
export function ShopInvitationsSection() {
  const t = useTranslations("shops");
  const { invites } = useShopInvitations();
  if (invites.length === 0) return null;
  return (
    <section className="space-y-3" data-testid="shop-invitations" aria-labelledby="shop-invitations-title">
      <h2 id="shop-invitations-title" className="text-lg font-bold">
        {t("invitations.title")}
      </h2>
      {invites.map((invite) => (
        <div key={invite.id} className="flex items-start gap-3 rounded-xl border bg-card p-4" data-testid={`shop-invitation-${invite.id}`}>
          <UserAvatar variant="shop" name={invite.shop.name} avatarUrl={invite.shop.logoUrl} size={44} />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm">
              {t("invitations.invitesYou", { inviter: invite.inviterName, shop: invite.shop.name, role: t(`roles.${invite.role}`) })}
              {invite.shop.verified && <VerifiedBadge className="ms-1 inline-block align-middle" />}
            </p>
            <p className="text-xs text-muted-foreground">{t("invitations.expiresIn", { count: daysLeft(invite.expiresAt) })}</p>
            <Actions invite={invite} size="sm" />
          </div>
        </div>
      ))}
    </section>
  );
}

/** Compact rows: the Selling-as menu's "Invitations" group and the no-shop dialog. */
export function InvitationRows() {
  const t = useTranslations("shops");
  const { invites } = useShopInvitations();
  if (invites.length === 0) return null;
  return (
    <div className="space-y-2" data-testid="sell-as-invitations">
      <h3 className="text-sm font-bold text-muted-foreground">{t("invitations.groupTitle")}</h3>
      {invites.map((invite) => (
        <div key={invite.id} className="flex items-center gap-3 rounded-xl border p-3" data-testid={`shop-invitation-${invite.id}`}>
          <UserAvatar variant="shop" name={invite.shop.name} avatarUrl={invite.shop.logoUrl} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{invite.shop.name}</p>
            <p className="text-xs text-muted-foreground">{t(`roles.${invite.role}`)}</p>
          </div>
          <Actions invite={invite} size="sm" />
        </div>
      ))}
    </div>
  );
}
