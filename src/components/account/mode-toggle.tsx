"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ShoppingBag, Store } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { setSellerMode } from "@/lib/api/me";
import { cn } from "@/lib/utils";

/**
 * Buyer ↔ Seller mode toggle (mobile parity). Persists `sellerMode` to the
 * backend and, like the app, drops you into the matching home — browse for
 * buyers, the listings dashboard for sellers. The header nav reads the same
 * `user.sellerMode` to emphasise the right actions.
 */
export function ModeToggle({ className }: { className?: string }) {
  const t = useTranslations();
  const router = useRouter();
  const { user, setUser } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!user) return null;
  const seller = user.sellerMode;

  async function switchTo(value: boolean) {
    if (value === seller || busy) return;
    setBusy(true);
    try {
      const updated = await setSellerMode(value);
      setUser(updated);
      router.push(value ? "/my-listings" : "/bazaar");
    } catch {
      toast.error(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const btn = (active: boolean) =>
    cn(
      "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
      active
        ? "bg-card text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground",
    );

  return (
    <div
      role="group"
      className={cn("inline-flex rounded-full border bg-muted p-0.5", className)}
    >
      <button
        type="button"
        onClick={() => switchTo(false)}
        disabled={busy}
        aria-pressed={!seller}
        className={btn(!seller)}
      >
        <ShoppingBag className="size-4" />
        {t("profile.buyerMode")}
      </button>
      <button
        type="button"
        onClick={() => switchTo(true)}
        disabled={busy}
        aria-pressed={seller}
        className={btn(seller)}
      >
        <Store className="size-4" />
        {t("profile.sellerMode")}
      </button>
    </div>
  );
}
