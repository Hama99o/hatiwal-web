import type { ReactNode } from "react";
import { X } from "lucide-react";
import { RemoteImage } from "@/components/shared/remote-image";

/**
 * One picked photo in a form's photo grid (the listing form, the shop's
 * "Photos & video"): the photo, its remove ×, and room for extra controls
 * (`children`, e.g. the shop form's move earlier / later).
 */
export function PhotoTile({
  src,
  onRemove,
  label,
  children,
}: {
  src: string;
  onRemove: () => void;
  label: string;
  children?: ReactNode;
}) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-lg border bg-muted" data-testid="photo-tile">
      <RemoteImage src={src} alt="" fill sizes="120px" className="object-cover" />
      <button
        type="button"
        onClick={onRemove}
        aria-label={label}
        className="absolute end-1 top-1 flex size-8 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
      >
        <X className="size-4" />
      </button>
      {children}
    </div>
  );
}
