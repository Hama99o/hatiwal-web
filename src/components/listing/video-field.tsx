"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { RefreshCw, Scissors, Trash2, Video, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { RemoteImage } from "@/components/shared/remote-image";
import { VideoBadge } from "@/components/shared/video-badge";
import { ListingVideoUploadStatus } from "@/components/listing/listing-video-upload-status";
import type { VideoTarget } from "@/lib/listing-video-upload";
import { formatDuration } from "@/lib/format";
import { MAX_VIDEO_DURATION_S, canUploadUnread, defaultWindow, getVideoInfo, needsTrim, type VideoWindow } from "@/lib/listing-video";

/**
 * VideoField — VID (1.1.9, docs/LISTING_VIDEO.md, Web 2): one OPTIONAL video
 * under the photos, the web twin of the app's VideoSection. Photos stay
 * required; photo #1 stays the cover.
 *
 * A clip over 60 s opens the trim window, set to the first 60 s — never an
 * error (owner rule). Nothing is uploaded here: the form saves the listing,
 * then hands the clip to the background uploader (listing-video-upload.ts),
 * which compresses it in the browser and shows its progress on the listing.
 */
export type VideoValue =
  | { kind: "remote"; posterUrl: string | null; durationS: number | null }
  | { kind: "local"; file: File; url: string; durationS: number; window: VideoWindow };

export function VideoField({
  value,
  onChange,
  listingId,
  uploadTarget,
}: {
  value: VideoValue | null;
  onChange: (next: VideoValue | null) => void;
  /** Editing a saved listing: shows its pending upload. */
  listingId?: number | null;
  /** SHOP-MEDIA: any other saved record whose pending upload to show (a shop). */
  uploadTarget?: VideoTarget | null;
}) {
  const t = useTranslations("listing.video");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [trim, setTrim] = useState<{ file: File; url: string; durationS: number; window: VideoWindow } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const inputId = useId();

  // A local clip's object URL lives as long as that clip is the value (a new
  // trim window keeps the same URL, so this keys on the URL, not the value).
  const localUrl = value?.kind === "local" ? value.url : null;
  useEffect(() => {
    return () => {
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [localUrl]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    let durationS = 0;
    try {
      durationS = (await getVideoInfo(file)).durationS;
    } catch {
      // This browser can't read it (codec). A phone MP4/MOV under the cap still
      // goes up as it is; anything else is the rare "use the app" case.
      if (!canUploadUnread(file)) {
        toast.error(t("needsApp"));
        return;
      }
    }
    const url = URL.createObjectURL(file);
    if (needsTrim(durationS)) {
      setTrim({ file, url, durationS, window: defaultWindow(durationS) });
      return;
    }
    onChange({ kind: "local", file, url, durationS, window: defaultWindow(durationS) });
  }

  function remove() {
    if (value?.kind === "remote") setConfirmRemove(true);
    else onChange(null);
  }

  const shownS = value ? (value.kind === "remote" ? value.durationS : value.window.endS - value.window.startS) : null;
  const picker = (
    <input id={inputId} type="file" accept="video/*" className="hidden" data-testid="video-input" onChange={onPick} />
  );

  return (
    <div className="space-y-2" data-testid="listing-form-field-video">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-medium">{t("title")}</span>
        <span className="text-xs text-muted-foreground">{t("optional")}</span>
      </div>

      {!value ? (
        <label
          htmlFor={inputId}
          className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-4 py-3 transition-colors hover:border-primary/50"
          data-testid="video-add-button"
        >
          <Video className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="flex-1">
            <span className="block text-sm font-semibold">{t("addVideo")}</span>
            <span className="block text-xs text-muted-foreground">{t("addHint")}</span>
          </span>
          {picker}
        </label>
      ) : (
        <div className="flex items-center gap-4">
          <div className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-muted" data-testid="video-tile">
            {value.kind === "remote" ? (
              value.posterUrl ? <RemoteImage src={value.posterUrl} alt={t("title")} fill sizes="96px" className="object-cover" /> : null
            ) : (
              // The first frame, from the local file — nothing downloaded.
              <video src={`${value.url}#t=${value.window.startS + 0.1}`} muted playsInline preload="metadata" className="size-full object-cover" />
            )}
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <VideoBadge label={shownS != null ? formatDuration(shownS, locale) : undefined} />
            </span>
            <button
              type="button"
              onClick={remove}
              aria-label={t("remove")}
              data-testid="video-remove"
              className="absolute end-1 top-1 inline-flex size-6 items-center justify-center rounded-full bg-black/55 text-white"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="flex flex-col items-start gap-1">
            <label htmlFor={inputId} className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium hover:underline" data-testid="video-replace">
              <RefreshCw className="size-4" aria-hidden />
              {t("replace")}
              {picker}
            </label>
            {value.kind === "local" && needsTrim(value.durationS) ? (
              <button
                type="button"
                data-testid="video-trim"
                className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
                onClick={() => setTrim({ file: value.file, url: value.url, durationS: value.durationS, window: value.window })}
              >
                <Scissors className="size-4" aria-hidden />
                {t("trim")}
              </button>
            ) : null}
            <button type="button" onClick={remove} className="inline-flex items-center gap-2 text-sm font-medium text-destructive hover:underline">
              <Trash2 className="size-4" aria-hidden />
              {t("remove")}
            </button>
          </div>
        </div>
      )}

      {uploadTarget ? (
        <ListingVideoUploadStatus target={uploadTarget} />
      ) : listingId ? (
        <ListingVideoUploadStatus listingId={listingId} />
      ) : null}

      {trim ? (
        <TrimDialog
          clip={trim}
          onDone={(window) => {
            onChange({ kind: "local", file: trim.file, url: trim.url, durationS: trim.durationS, window });
            setTrim(null);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={confirmRemove}
        title={t("removeConfirmTitle")}
        description={t("removeConfirmMessage")}
        confirmLabel={t("remove")}
        cancelLabel={tc("cancel")}
        destructive
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => {
          setConfirmRemove(false);
          onChange(null);
        }}
      />
    </div>
  );
}

/**
 * The 60 s window over a longer clip: a preview plus a slider for where it
 * starts. Closing keeps the first 60 s — a long clip is never refused. The
 * slider is a time axis and stays left-to-right in ps / fa, like the player's.
 */
function TrimDialog({
  clip,
  onDone,
}: {
  clip: { url: string; durationS: number; window: VideoWindow };
  onDone: (window: VideoWindow) => void;
}) {
  const t = useTranslations("listing.video");
  const locale = useLocale();
  const titleId = useId();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [startS, setStartS] = useState(clip.window.startS);
  const maxStart = Math.max(0, clip.durationS - MAX_VIDEO_DURATION_S);
  const endS = Math.min(clip.durationS, startS + MAX_VIDEO_DURATION_S);
  const window: VideoWindow = { startS, endS };
  const range = t("trimRange", { start: formatDuration(startS, locale), end: formatDuration(endS, locale) });

  return (
    <Dialog open onClose={() => onDone(window)} labelledBy={titleId} className="max-w-2xl">
      <h2 id={titleId} className="text-lg font-semibold">{t("trimTitle")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("trimHint")}</p>
      <video
        ref={videoRef}
        src={`${clip.url}#t=${startS}`}
        controls
        playsInline
        preload="metadata"
        className="mt-4 aspect-video w-full rounded-lg bg-black"
      />
      <div dir="ltr" className="mt-4 space-y-2">
        <input
          type="range"
          min={0}
          max={maxStart}
          step={0.5}
          value={startS}
          aria-label={range}
          data-testid="video-trim-window"
          onChange={(e) => {
            const s = Number(e.target.value);
            setStartS(s);
            if (videoRef.current) videoRef.current.currentTime = s;
          }}
          className="w-full accent-primary"
        />
        <p className="text-center text-sm font-semibold tabular-nums" data-testid="video-trim-range">{range}</p>
      </div>
      <div className="mt-4 flex justify-end">
        <Button data-testid="video-trim-done" onClick={() => onDone(window)}>
          {t("trimDone")}
        </Button>
      </div>
    </Dialog>
  );
}
