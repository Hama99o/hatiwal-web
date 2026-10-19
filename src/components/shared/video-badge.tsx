import { Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * VID — the small ▶ that says "this listing has a video", on card thumbnails
 * (and the sell form's video tile, with the clip length). Nothing else on a
 * card: no autoplay, no preview (docs/LISTING_VIDEO.md rule 5). The listing
 * page's own entry point is ListingVideoButton. Mirrors the app's VideoBadge.
 */
export function VideoBadge({ label, className }: { label?: string; className?: string }) {
  const t = useTranslations("listing.video");
  return (
    <span
      data-testid="video-badge"
      aria-label={t("hasVideo")}
      title={t("hasVideo")}
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center gap-1 rounded-full bg-black/55 px-1.5 text-[11px] font-semibold text-white",
        className,
      )}
    >
      <Play className="size-3 fill-current" aria-hidden />
      {label ? <span className="tabular-nums">{label}</span> : null}
    </span>
  );
}
