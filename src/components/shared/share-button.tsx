"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Share / copy-link button — the web analog of mobile's native share sheet
 * (ListingDetail / SellerProfile via Share.share + utils/shareUtils).
 *
 * On click it shares the CURRENT page URL (window.location.href — web pages are
 * their own canonical share URLs, no backend field needed):
 *  1. Web Share API when available (mobile browsers) → native share sheet with
 *     the localized title/text + URL.
 *  2. Otherwise → copy the URL to the clipboard + a "Link copied" sonner toast.
 *
 * The label is honest about what will happen: it hydrates as t('common.share')
 * and flips to t('common.copyLink') after mount when the Web Share API is
 * unavailable (typical desktop).
 */
export function ShareButton({
  shareTitle,
  text,
  className,
  variant = "outline",
  size = "sm",
}: {
  /** Title passed to navigator.share (e.g. the listing title / seller name). */
  shareTitle: string;
  /** Localized share body, mirrors mobile's listing.share.body / seller.share.body. */
  text: string;
  className?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  const t = useTranslations();
  // Assume share support for SSR/first paint; corrected after mount. Starting
  // true keeps the label matching the server-rendered HTML (no hydration
  // mismatch) on share-capable mobile browsers, which are the common case.
  const [canShare, setCanShare] = useState(true);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("common.linkCopied"));
    } catch {
      toast.error(t("common.error"));
    }
  }

  async function onShare() {
    const url = window.location.href;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text, url });
      } catch (err) {
        // User dismissed the sheet — not an error. Anything else (e.g. a
        // permission failure) falls back to copying the link.
        if (err instanceof DOMException && err.name === "AbortError") return;
        await copyLink(url);
      }
      return;
    }
    await copyLink(url);
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={onShare}
      className={cn("shrink-0", className)}
    >
      <Share2 aria-hidden />
      {canShare ? t("common.share") : t("common.copyLink")}
    </Button>
  );
}
