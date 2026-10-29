"use client";

import { cloneElement, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, Images } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Search by image: the two ways to get ONE photo (docs/design/IMAGE_SEARCH.md
 * in hatiwal-mobile) — "Take a photo" and "Choose from gallery", as Amazon
 * names them. On a touch device both are offered; with a mouse there is no
 * camera to open, so the trigger goes straight to the file chooser.
 *
 * `children` is the trigger (the header's plain 📷 icon, or a "Try another
 * photo" button); `onPick` gets the chosen file.
 */
export function PhotoPicker({
  children,
  onPick,
  align = "end",
}: {
  children: React.ReactElement<{ onClick?: () => void }>;
  onPick: (file: File) => void;
  align?: "start" | "end";
}) {
  const t = useTranslations("imageSearch");
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const touch = useCoarsePointer();
  const mounted = useMounted();

  // The two hidden inputs live at the END of <body> (a portal), not inside the
  // header: the 📷 is on every page, and a page's own file input (listing
  // photos, avatar, chat attachment) must stay the first one in the document.
  const inputs = mounted ? createPortal(
    <>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        data-testid="image-search-camera-input"
        onChange={(e) => take(e, onPick)}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        data-testid="image-search-gallery-input"
        onChange={(e) => take(e, onPick)}
      />
    </>,
    document.body,
  ) : null;

  if (!touch) {
    return (
      <>
        {cloneElement(children, { onClick: () => galleryRef.current?.click() })}
        {inputs}
      </>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
        <DropdownMenuContent align={align}>
          <DropdownMenuItem onSelect={() => cameraRef.current?.click()}>
            <Camera aria-hidden className="size-4" />
            {t("takePhoto")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => galleryRef.current?.click()}>
            <Images aria-hidden className="size-4" />
            {t("choosePhoto")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {inputs}
    </>
  );
}

function take(e: React.ChangeEvent<HTMLInputElement>, onPick: (file: File) => void) {
  const file = e.target.files?.[0];
  // Reset, so picking the SAME photo again still fires a change.
  e.target.value = "";
  if (file) onPick(file);
}

function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/** True on a phone or tablet (a finger, not a mouse). False until mounted. */
function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    setCoarse(mq.matches);
    const onChange = () => setCoarse(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return coarse;
}
