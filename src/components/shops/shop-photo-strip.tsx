"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { RemoteImage } from "@/components/shared/remote-image";
import { PhotoZoomDialog } from "@/components/shared/photo-zoom-dialog";
import type { ShopGalleryPhoto } from "@/lib/api/shops";

/**
 * SHOP-MEDIA (docs/SHOP_MEDIA.md): the shop's photos (up to 5) as a strip under
 * its header — the app's ShopPhotoStrip (Snapchat / Beli pattern,
 * docs/design/SHOP_MEDIA.md). A click opens the photo full-size. Nothing
 * without photos.
 */
export function ShopPhotoStrip({ photos, shopName }: { photos?: ShopGalleryPhoto[] | null; shopName: string }) {
  const t = useTranslations("shops.media");
  const [open, setOpen] = useState<number | null>(null);
  if (!photos?.length) return null;

  return (
    <section className="space-y-2" data-testid="shop-photo-strip">
      <h2 className="text-base font-bold">{t("photos")}</h2>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            data-testid={`shop-photo-${i}`}
            onClick={() => setOpen(i)}
            aria-label={`${t("photos")} ${i + 1}`}
            className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RemoteImage src={photo.thumbUrl ?? photo.mediumUrl ?? photo.url} fallbackSrc={photo.url} alt={`${shopName} ${i + 1}`} fill sizes="96px" className="object-cover" />
          </button>
        ))}
      </div>
      <PhotoZoomDialog
        open={open !== null}
        onClose={() => setOpen(null)}
        src={open !== null ? photos[open].url : null}
        title={shopName}
        testId="shop-photo-zoom"
      />
    </section>
  );
}
