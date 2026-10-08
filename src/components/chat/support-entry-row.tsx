"use client";

import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronRight, Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { openSupportConversation } from "@/lib/api/chat";
import { Logomark } from "@/components/layout/logo";
import { VerifiedBadge } from "@/components/shared/verified-badge";

/**
 * The permanent "Hatiwal Support" entry at the top of the inbox, while this
 * identity has no Support thread in view (mobile SupportEntryRow; parity sweep
 * 2026-10-08 — web could only reach Support from Profile → Help). Once a thread
 * exists it is an ordinary row and this one goes. `shopId`: the shop sold as,
 * so a shop opens ITS Support thread (Support is per identity).
 */
export function SupportEntryRow({ shopId }: { shopId?: number }) {
  const t = useTranslations();
  const router = useRouter();
  const open = useMutation({
    mutationFn: () => openSupportConversation(shopId),
    onSuccess: (c) => router.push(`/conversations/${c.id}`),
    onError: () =>
      toast.error(t("chat.support.openError"), {
        action: { label: t("common.retry"), onClick: () => open.mutate() },
      }),
  });
  const name = t("chat.support.name");
  return (
    <button
      type="button"
      onClick={() => !open.isPending && open.mutate()}
      disabled={open.isPending}
      aria-busy={open.isPending}
      data-testid="support-entry-row"
      className="flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-start transition-colors hover:bg-accent disabled:opacity-70"
    >
      <Logomark className="size-12 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 font-semibold">
          <span className="truncate">{name}</span>
          <VerifiedBadge />
        </span>
        <span className="block truncate text-sm text-muted-foreground">{t("chat.support.entrySubtitle")}</span>
      </span>
      {open.isPending ? (
        <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
      ) : (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground rtl:-scale-x-100" aria-hidden />
      )}
    </button>
  );
}
