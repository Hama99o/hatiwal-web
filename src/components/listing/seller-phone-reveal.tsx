"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Phone } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { useLoginHref } from "@/components/auth/login-href";
import { useIsOwner } from "@/components/auth/owner-gate";
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
  const loginHref = useLoginHref();
  const { status } = useAuth();
  // Shared owner rule (`useIsOwner`) — the same test every owner-gated control
  // on the listing page uses, so "is this mine?" is decided in exactly one place.
  const isOwner = useIsOwner(sellerId);
  const [revealed, setRevealed] = useState(false);

  if (!phone) return null;
  if (isOwner) return null; // your own listing — you know your own number

  if (!revealed) {
    return (
      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          if (status !== "authed") {
            // `?next=` so signing in returns them to this listing instead of
            // /profile — one shared helper for every gated action (login-href.ts).
            router.push(loginHref());
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
