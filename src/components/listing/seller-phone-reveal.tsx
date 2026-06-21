"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Phone } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";

/**
 * Gated phone reveal in the seller card (mirrors mobile SellerPhoneReveal):
 * tap once to reveal (guests → sign in), then tap to call. Hidden when the
 * seller has no phone, or on your own listing.
 */
export function SellerPhoneReveal({
  phone,
  sellerId,
}: {
  phone?: string | null;
  sellerId?: number;
}) {
  const t = useTranslations();
  const router = useRouter();
  const { status, user } = useAuth();
  const [revealed, setRevealed] = useState(false);

  if (!phone) return null;
  if (status === "authed" && user && sellerId && user.id === sellerId) {
    return null; // your own listing
  }

  if (!revealed) {
    return (
      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          if (status !== "authed") {
            router.push("/login");
            return;
          }
          setRevealed(true);
        }}
      >
        <Phone className="size-4" />
        {t("listing.detail.showPhone")}
      </Button>
    );
  }

  return (
    <Button asChild variant="outline" className="w-full">
      <a href={`tel:${phone}`} dir="ltr">
        <Phone className="size-4" />
        {t("listing.detail.callSeller")} · {phone}
      </a>
    </Button>
  );
}
