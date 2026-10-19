"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { RemoteImage } from "@/components/shared/remote-image";

/**
 * The ONE full-screen photo view: the ORIGINAL, shown whole, never upscaled.
 * Used by the listing gallery (click the big photo) and the shop photo strip
 * (SHOP-MEDIA). Extracted from ListingGallery unchanged.
 */
export function PhotoZoomDialog({
  open,
  onClose,
  src,
  title,
  testId = "listing-gallery-zoom",
}: {
  open: boolean;
  onClose: () => void;
  src: string | null;
  title: string;
  testId?: string;
}) {
  const t = useTranslations("common");
  const titleId = useId();
  return (
    <Dialog open={open} onClose={onClose} labelledBy={titleId} className="max-w-5xl bg-black p-0">
      <h2 id={titleId} className="sr-only">{title}</h2>
      <div className="relative h-[80vh] w-full" data-testid={testId}>
        <RemoteImage src={src} alt={title} fill sizes="100vw" className="object-scale-down" />
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={t("close")}
        className="absolute end-2 top-2 inline-flex size-10 items-center justify-center rounded-full bg-black/60 text-white"
      >
        <X className="size-5" />
      </button>
    </Dialog>
  );
}
