"use client";

import { useTranslations } from "next-intl";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";

/**
 * Web-native "Message seller" action (replaces the old "open in the app" CTA).
 * Guests are sent to sign in; signed-in users get a coming-soon notice until
 * web chat lands in Phase 4. No app push.
 */
export function MessageSellerButton({
  className,
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "outline" | "secondary";
}) {
  const t = useTranslations();
  const { status } = useAuth();

  if (status === "authed") {
    return (
      <Button
        variant={variant}
        className={className}
        onClick={() => toast(t("listing.detail.chatComingSoon"))}
      >
        <MessageCircle className="size-4" />
        {t("listing.detail.messageSeller")}
      </Button>
    );
  }

  return (
    <Button asChild variant={variant} className={className}>
      <Link href="/login">
        <MessageCircle className="size-4" />
        {t("listing.detail.messageSeller")}
      </Link>
    </Button>
  );
}
