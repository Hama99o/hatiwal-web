"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { RemoteImage } from "@/components/shared/remote-image";
import { Dialog } from "@/components/ui/dialog";
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
}) {
  const t = useTranslations("common");
  const titleId = useId();
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
      <Dialog
        open={zoomed}
        onClose={() => setZoomed(false)}
        labelledBy={titleId}
        className="max-w-5xl bg-black p-0"
      >
        <h2 id={titleId} className="sr-only">{title}</h2>
        <div className="relative h-[80vh] w-full" data-testid="listing-gallery-zoom">
          <RemoteImage src={original} alt={title} fill sizes="100vw" className="object-scale-down" />
        </div>
        <button
          type="button"
          onClick={() => setZoomed(false)}
          aria-label={t("close")}
          className="absolute end-2 top-2 inline-flex size-10 items-center justify-center rounded-full bg-black/60 text-white"
        >
          <X className="size-5" />
        </button>
      </Dialog>
    </div>
  );
}
