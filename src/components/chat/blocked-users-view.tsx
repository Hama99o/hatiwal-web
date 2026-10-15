"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { getBlockedUsers, unblockShop, unblockUser } from "@/lib/api/chat";
import { isShopFace } from "@/lib/identity";
import type { ConversationParticipant } from "@/lib/types";
import { UserIdentity } from "@/components/shared/user-identity";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function BlockedUsersView() {
  const t = useTranslations();
  const qc = useQueryClient();
  const { data, isPending, isError } = useQuery({
    queryKey: ["blocked-users"],
    queryFn: getBlockedUsers,
  });
  const [busyKey, setBusyKey] = useState<string | null>(null);

  /**
   * privacy-b: a block made via a SHOP comes back as `{ id: null, shopId,
   * asShop: true }` — the owner's personal id is never sent — and is undone with
   * DELETE /shops/:shopId/block. A person row keeps the user path. Keyed per
   * kind, since a shop id and a user id can be the same number.
   */
  function rowKey(u: ConversationParticipant): string | null {
    if (isShopFace(u)) return u.shopId != null ? `shop-${u.shopId}` : null;
    return u.id != null ? `user-${u.id}` : null;
  }

  async function unblock(u: ConversationParticipant) {
    const key = rowKey(u);
    if (!key) return;
    const shop = isShopFace(u);
    setBusyKey(key);
    try {
      if (shop) await unblockShop(u.shopId as number);
      else await unblockUser(u.id as number);
      toast.success(t(shop ? "chat.block.shopUnblockSuccess" : "chat.block.unblockSuccess"));
      qc.invalidateQueries({ queryKey: ["blocked-users"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["conversation"] });
    } catch {
      toast.error(t("chat.block.unblockFailed"));
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-title font-extrabold">
        {t("profile.blockedUsers")}
      </h1>

      {isError ? (
        <EmptyState icon={ShieldOff} title={t("common.error")} />
      ) : isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <EmptyState
          icon={ShieldOff}
          title={t("profile.blocked.emptyTitle")}
          description={t("profile.blocked.emptyDescription")}
        />
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {data.map((u, i) => {
            const key = rowKey(u);
            const shop = isShopFace(u);
            return (
              <li
                key={key ?? `row-${i}`}
                className="flex items-center justify-between gap-3 p-3"
                data-testid={shop ? "blocked-shop-row" : "blocked-user-row"}
              >
                {/* Not linked: an unblocked profile is one tap away from the
                    chat anyway, and a shop row must never become /sellers/null. */}
                <UserIdentity
                  name={u.name}
                  avatarUrl={u.avatarUrl} avatarFallbackUrl={u.avatarOriginalUrl}
                  verified={u.verified}
                  subtitle={u.city}
                  variant={shop ? "shop" : "default"}
                  size={40}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={key == null || busyKey === key}
                  onClick={() => unblock(u)}
                >
                  {t(shop ? "chat.block.unblockShop" : "chat.block.unblockUser")}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
