"use client";

import { useState, type ReactNode } from "react";
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
  /**
   * Width-described candidates (`"<thumb> 640w, <medium> 1440w"`) the browser
   * picks from with `sizes`. Only for COVER-cropped spots (cards): `w`
   * descriptors change the image's intrinsic size, which a contained or
   * scale-down photo would then be laid out (and upscaled) by. Dropped once a
   * load fails.
   */
  srcSet?: string | null;
  /**
   * Shown when `src` fails to load (1.1.6 photo variants: a variant that
   * cannot be served falls back to the original — always the url the api sent,
   * never one built from the variant's). When that fails too — or there is
   * none — the no-photo tile (or `fallback`): never a broken image.
   */
  fallbackSrc?: string | null;
  /** Rendered instead of the no-photo tile when every url failed (UserAvatar: the initials). */
  fallback?: ReactNode;
}

/**
 * next/image wrapper that degrades to a neutral placeholder when there's no src
 * or it fails to load (after trying `fallbackSrc`).
 * Optimization is disabled globally (see next.config.ts) because Rails serves
 * short-lived signed urls, so any host works without remotePatterns.
 */
export function RemoteImage({
  src: requested,
  alt,
  fill,
  width,
  height,
  sizes,
  className,
  priority,
  label,
  srcSet,
  fallbackSrc,
  fallback,
}: RemoteImageProps) {
  // URLs that failed to load. Keyed by URL, so a new `src` (the gallery's
  // next photo) starts clean while a known-bad one is not retried.
  const [failed, setFailed] = useState<string[]>([]);
  const src = [requested, fallbackSrc].find((u): u is string => !!u && !failed.includes(u)) ?? null;
  const fail = () => src && setFailed((f) => (f.includes(src) ? f : [...f, src]));
  // An image that errored BEFORE hydration fired its error event with no React
  // listener attached: catch it on mount (complete, yet no pixels).
  const catchEarlyError = (img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth === 0 && img.getAttribute("src")) fail();
  };
  const candidates = src === requested && !failed.length ? srcSet || undefined : undefined;

  if (!src && failed.length && fallback !== undefined) return <>{fallback}</>;

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

  if (candidates) {
    // next/image (unoptimized) writes no srcset of its own and would drop ours,
    // so a candidate list takes the plain <img> next/image renders here anyway.
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a srcset, see above
      <img
        key={src}
        ref={catchEarlyError}
        src={src}
        srcSet={candidates}
        sizes={sizes}
        alt={alt}
        onError={fail}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
        width={fill ? undefined : (width ?? 64)}
        height={fill ? undefined : (height ?? 64)}
        className={cn(fill && "absolute inset-0 size-full", className)}
      />
    );
  }

  if (fill) {
    return (
      <Image
        key={src}
        ref={catchEarlyError}
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className={className}
        priority={priority}
        onError={fail}
      />
    );
  }

  return (
    <Image
      key={src}
      ref={catchEarlyError}
      src={src}
      alt={alt}
      width={width ?? 64}
      height={height ?? 64}
      className={className}
      priority={priority}
      onError={fail}
    />
  );
}
