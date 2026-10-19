"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PhotoTile } from "@/components/shared/photo-tile";
import { VideoField, type VideoValue } from "@/components/listing/video-field";
import { useRouter } from "@/i18n/navigation";
import { MAX_SHOP_PHOTOS, deleteShopVideo, getMyShop, updateShopGallery } from "@/lib/api/shops";
import { discardVideoUpload, startVideoUpload } from "@/lib/listing-video-upload";

/**
 * SHOP-MEDIA (docs/SHOP_MEDIA.md): the shop's "Photos & video" — the app's
 * ShopMediaScreen. Up to 5 photos (add, remove, move earlier / later) and the
 * listing video's VideoField. Save writes the gallery in one call, then a newly
 * picked video compresses + uploads in the background (saving never waits).
 */
type Photo = { kind: "remote"; id: string; url: string } | { kind: "new"; file: File; url: string };

export function ShopMediaForm({ shopId }: { shopId: number }) {
  const t = useTranslations("shops.media");
  const tc = useTranslations("common");
  const qc = useQueryClient();
  const router = useRouter();
  const { data: shop } = useQuery({ queryKey: ["shop", shopId], queryFn: () => getMyShop(shopId) });
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [video, setVideo] = useState<VideoValue | null>(null);
  const [saving, setSaving] = useState(false);
  const target = { kind: "shop" as const, id: shopId };

  // Fill once; a later refetch must not undo the seller's edits.
  const filled = useRef(false);
  useEffect(() => {
    if (!shop || filled.current) return;
    filled.current = true;
    setPhotos((shop.galleryPhotos ?? []).map((p) => ({ kind: "remote", id: p.id, url: p.thumbUrl ?? p.url })));
    setVideo(shop.hasVideo ? { kind: "remote", posterUrl: shop.videoPosterUrl ?? shop.coverUrl ?? null, durationS: shop.videoDurationS ?? null } : null);
  }, [shop]);

  // Object URLs of new photos live as long as the form.
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_SHOP_PHOTOS - photos.length);
    e.target.value = "";
    const added: Photo[] = files.map((file) => {
      const url = URL.createObjectURL(file);
      urls.current.push(url);
      return { kind: "new", file, url };
    });
    setPhotos((prev) => [...prev, ...added]);
  };

  const move = (i: number, by: -1 | 1) =>
    setPhotos((prev) => {
      const next = [...prev];
      const j = i + by;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  async function save() {
    setSaving(true);
    try {
      const keepIds = photos.filter((p) => p.kind === "remote").map((p) => (p as { id: string }).id);
      // Kept photos keep their order; new ones are appended (the API's contract).
      const files = photos.filter((p) => p.kind === "new").map((p) => (p as { file: File }).file);
      const fresh = await updateShopGallery(shopId, keepIds, files);
      qc.setQueryData(["shop", shopId], fresh);
      if (video?.kind === "local") {
        startVideoUpload(qc, target, video.file, video.window);
      } else if (!video && shop?.hasVideo) {
        discardVideoUpload(target);
        deleteShopVideo(shopId)
          .then(() => toast.success(t("videoRemoved")))
          .catch(() => toast.error(t("saveFailed")));
      }
      toast.success(t("saved"));
      router.push(`/shops/${shopId}`);
      router.refresh();
    } catch {
      toast.error(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8" data-testid="shop-media">
      <div className="space-y-1">
        <h1 className="text-title font-extrabold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium">{t("photos")}</span>
          <span className="text-xs text-muted-foreground" data-testid="shop-media-count">
            {photos.length}/{MAX_SHOP_PHOTOS}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {photos.map((p, i) => (
            <PhotoTile
              key={p.kind === "remote" ? p.id : p.url}
              src={p.url}
              onRemove={() => setPhotos((prev) => prev.filter((_, k) => k !== i))}
              label={t("removePhoto")}
            >
              {/* Earlier / later follow the reading direction (the arrows mirror in ps/fa/ur). */}
              <div className="absolute inset-x-1 bottom-1 flex justify-between">
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t("moveEarlier")}
                  className="flex size-8 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80 disabled:invisible"
                  data-testid="shop-media-photo-earlier">
                  <ArrowLeft className="size-4 rtl:-scale-x-100" />
                </button>
                <button type="button" disabled={i === photos.length - 1} onClick={() => move(i, 1)} aria-label={t("moveLater")}
                  className="flex size-8 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80 disabled:invisible"
                  data-testid="shop-media-photo-later">
                  <ArrowRight className="size-4 rtl:-scale-x-100" />
                </button>
              </div>
            </PhotoTile>
          ))}
          {photos.length < MAX_SHOP_PHOTOS && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-muted-foreground hover:border-primary/50"
              data-testid="shop-media-add">
              <ImagePlus className="size-6" />
              <span className="text-xs">{t("addPhoto")}</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={onPick} data-testid="shop-media-input" />
            </label>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t("photosHint")}</p>
      </div>

      <VideoField value={video} onChange={setVideo} uploadTarget={target} />

      <Button onClick={save} disabled={saving || !shop} data-testid="shop-media-save" className="w-full">
        {tc("save")}
      </Button>
    </div>
  );
}
