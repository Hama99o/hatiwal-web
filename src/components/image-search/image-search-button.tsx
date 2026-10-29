"use client";

import { Camera } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { loginHref } from "@/components/auth/login-href";
import { setPendingPhoto } from "@/lib/image-search/pending-photo";
import { PhotoPicker } from "./photo-picker";

export const IMAGE_SEARCH_PATH = "/image-search";

const BUTTON_CLASS =
  "absolute end-0 top-1/2 size-10 -translate-y-1/2 rounded-full text-muted-foreground hover:bg-transparent hover:text-foreground";

/** Hand a picked photo to the results page (in memory, see pending-photo.ts). */
export function useStartImageSearch() {
  const router = useRouter();
  const pathname = usePathname();
  return (file: File) => {
    const { id } = setPendingPhoto(file);
    const href = `${IMAGE_SEARCH_PATH}?p=${id}`;
    if (pathname === IMAGE_SEARCH_PATH) router.replace(href);
    else router.push(href);
  };
}

/**
 * The plain muted 📷 at the end of the search field (the owner's "plain icon
 * action" rule: no pill, no border). Hosts render it only when
 * `useImageSearchEnabled()` (GET /app_config → features.image_search), so the
 * field reserves no room for it on a server that cannot search by image.
 *
 * On the WEB, search by image needs a signed-in buyer (supervisor decision
 * 2026-10-29): every web guest reaches Rails from the web server's one IP, so
 * the per-IP limit would be shared by all of them. A guest's tap is the site's
 * usual "sign in to continue" (`/login?next=`), and signing in lands on the
 * search page, ready to pick the photo. 1.2.1 follow-up: forward the client IP
 * from Next once the proxy trust is verified, and open it to guests again.
 * (The mobile app talks to Rails directly, so its guests keep their own limit.)
 */
export function ImageSearchButton() {
  const t = useTranslations("imageSearch");
  const start = useStartImageSearch();
  const router = useRouter();
  const { status } = useAuth();

  if (status !== "authed") {
    // "loading" counts as a guest here: a signed-in viewer sent to /login is
    // bounced straight to `next` by login-form.tsx, so the worst case is one
    // extra hop, never a dead end.
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t("button")}
        title={t("button")}
        data-testid="image-search-button"
        onClick={() => router.push(loginHref(IMAGE_SEARCH_PATH))}
        className={BUTTON_CLASS}
      >
        <Camera aria-hidden />
      </Button>
    );
  }

  return (
    <PhotoPicker onPick={start}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t("button")}
        title={t("button")}
        data-testid="image-search-button"
        className={BUTTON_CLASS}
      >
        <Camera aria-hidden />
      </Button>
    </PhotoPicker>
  );
}
