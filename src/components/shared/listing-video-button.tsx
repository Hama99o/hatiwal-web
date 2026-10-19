"use client";

import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Play, X } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * VID (owner 2026-10-19, docs/LISTING_VIDEO.md rule 5, Web 1): the ONE way to
 * watch a listing's video — a clear "▶ Video · 0:42" pill on the main photo,
 * visible with no scrolling (never a slide after the photos). One click opens
 * it full-screen and plays; the click is the consent, so this is not autoplay.
 * `preload="none"` until then: nothing downloads before the click.
 * Design: docs/design/LISTING_VIDEO_BUTTON.md. Mirrors the app's
 * ListingVideoButton.
 */
export interface ListingVideo {
  url: string;
  posterUrl?: string | null;
  durationS?: number | null;
}

export function ListingVideoButton({ video, className }: { video: ListingVideo | null | undefined; className?: string }) {
  const t = useTranslations("listing.video");
  const tc = useTranslations("common");
  const locale = useLocale();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!video?.url) return null;
  const label = video.durationS ? t("button", { duration: formatDuration(video.durationS, locale) }) : t("title");

  return (
    <>
      <button
        type="button"
        data-testid="listing-video-button"
        aria-label={t("play")}
        onClick={(e) => {
          e.stopPropagation(); // the photo under it opens the photo zoom
          setFailed(false);
          setOpen(true);
        }}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-full border border-white/15 bg-black/70 px-3.5 text-sm font-bold text-white shadow-sm backdrop-blur-sm transition hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        <Play className="size-3.5 fill-current" aria-hidden />
        <span className="tabular-nums">{label}</span>
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} labelledBy={titleId} className="max-w-5xl bg-black p-0">
        <h2 id={titleId} className="sr-only">{t("title")}</h2>
        <div className="flex h-[80vh] w-full items-center justify-center" data-testid="listing-video-modal">
          {failed ? (
            <p className="px-6 text-center text-sm text-white/70" data-testid="listing-video-unavailable">
              {t("notAvailable")}
            </p>
          ) : open ? (
            <video
              data-testid="listing-video-player"
              src={video.url}
              poster={video.posterUrl ?? undefined}
              controls
              autoPlay
              playsInline
              preload="none"
              onError={() => setFailed(true)}
              className="h-full w-full object-contain"
            />
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={tc("close")}
          data-testid="listing-video-close"
          className="absolute end-2 top-2 inline-flex size-10 items-center justify-center rounded-full bg-black/60 text-white"
        >
          <X className="size-5" />
        </button>
      </Dialog>
    </>
  );
}
