"use client";

import { useState } from "react";
import { RemoteImage } from "@/components/shared/remote-image";
import { PhotoZoomDialog } from "@/components/shared/photo-zoom-dialog";
import { ListingVideoButton, type ListingVideo } from "@/components/shared/listing-video-button";
import { cn } from "@/lib/utils";

/**
 * The listing's photos (1.1.6 photo variants, owner): the big photo is the
 * MEDIUM (1200px), the strip the light THUMBS, and a tap on the big photo opens
 * the ORIGINAL full-screen. `mediums` / `thumbs` come from normalizeListing
 * (same length and order as `images`, already falling back to the originals).
 *
 * Owner rules: the crop is unchanged (strip thumbs cover-crop, the big photo
 * and the full-screen one show it whole), a small photo is never upscaled
 * (`object-scale-down`: shrink to fit, else natural size), and a variant that
 * fails to load falls back to the original, then to the no-photo tile.
 */
export function ListingGallery({
  images,
  mediums = images,
  thumbs = mediums,
  title,
  dimmed = false,
  video,
}: {
  /** The originals: what the full-screen view shows. */
  images: string[];
  mediums?: string[];
  thumbs?: string[];
  title: string;
  /**
   * Archived stock reads as archived: a sold listing's photos are dimmed, the
   * `sold` row of DESIGN_SYSTEM §2 ("grey, dimmed"). Opacity only — no filter,
   * so the photo stays true in both themes — and only ever set for `sold`, so a
   * reserved item (which can still come back) keeps its full-strength photo.
   */
  dimmed?: boolean;
  /**
   * VID: the listing's optional video — a "▶ Video · 0:42" button ON the main
   * photo (never a slide after the photos), opening it full-screen.
   */
  video?: ListingVideo | null;
}) {
  const [active, setActive] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const pick = (list: string[], i: number) => list[i] ?? images[i] ?? images[0] ?? null;
  const main = pick(mediums, active);
  const original = images[active] ?? images[0] ?? null;

  return (
    <div
      className={cn("space-y-3", dimmed && "opacity-70")}
      data-testid="listing-gallery"
    >
      <div className="relative">
      <button
        type="button"
        onClick={() => original && setZoomed(true)}
        disabled={!original}
        aria-label={title}
        data-testid="listing-gallery-main"
        className="relative block aspect-square w-full cursor-zoom-in overflow-hidden rounded-lg border bg-muted disabled:cursor-default sm:aspect-[4/3]"
      >
        <RemoteImage
          src={main}
          fallbackSrc={original}
          alt={title}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-scale-down"
          priority
        />
      </button>
      {/* A sibling, not inside the photo button (no nested buttons). */}
      <ListingVideoButton video={video} className="absolute bottom-3 end-3" />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`${title} ${i + 1}`}
              className={cn(
                "relative size-16 shrink-0 overflow-hidden rounded-md border bg-muted",
                i === active
                  ? "ring-2 ring-primary"
                  : "opacity-70 hover:opacity-100",
              )}
            >
              <RemoteImage
                src={pick(thumbs, i)}
                fallbackSrc={images[i]}
                alt={`${title} ${i + 1}`}
                fill
                sizes="64px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
      <PhotoZoomDialog open={zoomed} onClose={() => setZoomed(false)} src={original} title={title} />
    </div>
  );
}
