"use client";

import { useState } from "react";
import { RemoteImage } from "@/components/shared/remote-image";
import { cn } from "@/lib/utils";

export function ListingGallery({
  images,
  title,
  dimmed = false,
}: {
  images: string[];
  title: string;
  /**
   * Archived stock reads as archived: a sold listing's photos are dimmed, the
   * `sold` row of DESIGN_SYSTEM §2 ("grey, dimmed"). Opacity only — no filter,
   * so the photo stays true in both themes — and only ever set for `sold`, so a
   * reserved item (which can still come back) keeps its full-strength photo.
   */
  dimmed?: boolean;
}) {
  const [active, setActive] = useState(0);
  const main = images[active] ?? images[0] ?? null;

  return (
    <div
      className={cn("space-y-3", dimmed && "opacity-70")}
      data-testid="listing-gallery"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-lg border bg-muted sm:aspect-[4/3]">
        <RemoteImage
          src={main}
          alt={title}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-contain"
          priority
        />
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
                src={src}
                alt={`${title} ${i + 1}`}
                fill
                sizes="64px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
