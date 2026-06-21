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
}: RemoteImageProps) {
  if (!src) {
    // Intentional "item has no photo" tile — a calm solid fill with a neutral
    // marketplace glyph, deliberately NOT the image/mountain icon (which reads
    // as a *broken* image).
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground/40",
          className,
        )}
      >
        <Package className="size-7" strokeWidth={1.5} />
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
