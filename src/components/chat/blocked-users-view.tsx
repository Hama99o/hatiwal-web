"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { getBlockedUsers, unblockUser } from "@/lib/api/chat";
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
  const [busyId, setBusyId] = useState<number | null>(null);

  async function unblock(userId: number) {
    setBusyId(userId);
    try {
      await unblockUser(userId);
      toast.success(t("chat.block.unblockSuccess"));
      qc.invalidateQueries({ queryKey: ["blocked-users"] });
    } catch {
      toast.error(t("chat.block.unblockFailed"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">
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
          {data.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-3 p-3">
              <UserIdentity
                name={u.name}
                avatarUrl={u.avatarUrl}
                subtitle={u.city}
                size={40}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={busyId === u.id}
                onClick={() => unblock(u.id)}
              >
                {t("chat.block.unblockUser")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
