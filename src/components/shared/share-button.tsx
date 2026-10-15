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
 *
 * Defaults to the `default` (40px) size, not `sm`: this ships beside Report on
 * the listing and seller pages, and at 36px it was both uneven with it and under
 * the house touch-target floor. The floor lives here so the next call site gets
 * it for free — pass `size` only to go deliberately smaller in a dense row.
 */
export function ShareButton({
  shareTitle,
  text,
  className,
  variant = "outline",
  size = "default",
  url: shareUrl,
  label,
  testId,
}: {
  /** The link to share; defaults to the current page. SHOP-1 passes https://hatiwal.com/s/<id>. */
  url?: string;
  /** Button label override (e.g. "Share my shop"); defaults to Share / Copy link. */
  label?: string;
  testId?: string;
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
      return;
    } catch {
      // In-app browsers (WhatsApp, Facebook) often block the async clipboard.
    }
    if (legacyCopy(url)) {
      toast.success(t("common.linkCopied"));
      return;
    }
    // Last resort: show the link so it can still be copied by hand — a bare
    // "Error" left the user with nothing (web UI/UX QA 2026-10-15).
    toast.error(t("common.error"), { description: url });
  }

  async function onShare() {
    const url = shareUrl ?? window.location.href;
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
      data-testid={testId}
      data-share-url={shareUrl}
    >
      <Share2 aria-hidden />
      {label ?? (canShare ? t("common.share") : t("common.copyLink"))}
    </Button>
  );
}

/** The pre-Clipboard-API copy: a selected off-screen textarea + execCommand. */
function legacyCopy(text: string): boolean {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    ta.remove();
  }
}
