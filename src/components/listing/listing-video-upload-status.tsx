"use client";

import { useLocale, useTranslations } from "next-intl";
import { AlertCircle, RotateCw, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { retryListingVideoUpload, useListingVideoUpload } from "@/lib/listing-video-upload";

/**
 * VID — the seller's "where is my video" line under their listing: preparing
 * N % → uploading N % → gone on success; failed → Retry; a browser that can't
 * prepare it → "add it from the app". Nothing when no upload is pending. The
 * listing is live the whole time (docs/LISTING_VIDEO.md rule 4).
 */
export function ListingVideoUploadStatus({ listingId }: { listingId: number }) {
  const t = useTranslations("listing.video");
  const locale = useLocale();
  const job = useListingVideoUpload(listingId);
  if (!job) return null;

  if (job.phase === "failed" || job.phase === "needs_app") {
    return (
      <div
        data-testid="video-upload-failed"
        role="status"
        className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-card px-3 py-2.5 text-sm"
      >
        <AlertCircle className="size-4 shrink-0 text-destructive" aria-hidden />
        <p className="flex-1">{job.phase === "needs_app" ? t("needsApp") : t("failed")}</p>
        {job.phase === "failed" && (
          <Button variant="ghost" size="sm" data-testid="video-upload-retry" onClick={() => retryListingVideoUpload(listingId)}>
            <RotateCw className="size-4" aria-hidden />
            {t("retry")}
          </Button>
        )}
      </div>
    );
  }

  const percent = formatNumber(Math.round(job.progress * 100), locale);
  return (
    <div data-testid="video-upload-progress" role="status" className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm">
      <Video className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="flex-1 space-y-1.5">
        <p>{job.phase === "preparing" ? t("compressing", { percent }) : t("uploading", { percent })}</p>
        <div className="h-1 overflow-hidden rounded-full bg-muted">
          <div className="h-1 rounded-full bg-primary transition-[width]" style={{ width: `${Math.max(2, Math.round(job.progress * 100))}%` }} />
        </div>
      </div>
    </div>
  );
}
