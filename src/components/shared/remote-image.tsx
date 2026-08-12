import Image from "next/image";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface RemoteImageProps {
  src?: string | null;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  className?: string;
  priority?: boolean;
  /**
   * Caption under the no-photo glyph (pass `t('listing.noPhoto')`). Only for the
   * contexts where the missing photo is something to ACT on — the seller's own
   * card on `/my-listings`, where "no photo" is why nobody is messaging them
   * (`ListingCard`'s `nameMissingPhoto`). On any buyer-facing grid leave it off:
   * there the quiet glyph is right and a caption on every photoless card would be
   * noise. Ignored when there is a `src`.
   */
  label?: string;
}

/**
 * next/image wrapper that degrades to a neutral placeholder when there's no src.
 * Optimization is disabled globally (see next.config.ts) because Rails serves
 * short-lived signed urls, so any host works without remotePatterns.
 */
export function RemoteImage({
  src,
  alt,
  fill,
  width,
  height,
  sizes,
  className,
  priority,
  label,
}: RemoteImageProps) {
  if (!src) {
    // Intentional "item has no photo" tile — a calm solid fill with a neutral
    // marketplace glyph, deliberately NOT the image/mountain icon (which reads
    // as a *broken* image). When `fill` is requested the real <Image fill> is
    // absolutely positioned to fill its relative parent, so the placeholder must
    // do the same (absolute inset-0) — otherwise it collapses to the icon's
    // height inside the aspect-ratio box. Non-fill gets an explicit size.
    //
    // With a `label` the tile stops being decorative and states the gap in words
    // (seller contexts — see the prop). The caption gets the full
    // `text-muted-foreground` token rather than the glyph's /40 wash, because it
    // is text a seller has to read; the glyph stays quiet so the two don't
    // compete. `text-xs` is the bottom of the house type scale (DESIGN_SYSTEM §3)
    // and matches mobile's two equivalents (both 11px) — and it still fits the
    // tightest tile: "No photo" is ~54px and the ps/fa strings ~60px inside the
    // ~88px content box of the 96px `list` thumbnail, so `truncate` never fires at
    // the narrow end. The children are invisible to a screen reader either way
    // (`role="img"` prunes its subtree), so the accessible name is still the
    // listing title and the caption adds no duplicate announcement.
    return (
      <div
        role="img"
        aria-label={alt}
        style={fill ? undefined : { width: width ?? 64, height: height ?? 64 }}
        className={cn(
          "flex flex-col items-center justify-center gap-1 bg-muted text-muted-foreground/40",
          fill && "absolute inset-0",
          className,
        )}
      >
        <Package className="size-7" strokeWidth={1.5} />
        {label && (
          <span className="max-w-full truncate px-1 text-xs font-medium leading-tight text-muted-foreground">
            {label}
          </span>
        )}
      </div>
    );
  }

  if (fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className={className}
        priority={priority}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width ?? 64}
      height={height ?? 64}
      className={className}
      priority={priority}
    />
  );
}
