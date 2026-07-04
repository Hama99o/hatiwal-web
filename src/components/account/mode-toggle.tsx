"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ShoppingBag, Store } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { setSellerMode } from "@/lib/api/me";
import { SegmentedControl } from "@/components/shared/segmented-control";

type Mode = "buyer" | "seller";

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

  return (
    <SegmentedControl<Mode>
      className={className}
      fullWidth
      disabled={busy}
      ariaLabel={t("profile.modeToggleLabel")}
      value={seller ? "seller" : "buyer"}
      onChange={(mode) => switchTo(mode === "seller")}
      options={[
        { value: "buyer", label: t("profile.buyerMode"), icon: ShoppingBag },
        { value: "seller", label: t("profile.sellerMode"), icon: Store },
      ]}
    />
  );
}
