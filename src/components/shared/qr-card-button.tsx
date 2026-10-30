"use client";

import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Download, Printer, QrCode } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { LOCALE_LABEL } from "@/components/layout/locale-switcher";
import { qrCardUrl, shareLang, SHARE_LANGS, type ShareLang } from "@/lib/share-link";
import { cn } from "@/lib/utils";

/**
 * IDEA-8 (1.2.1, hatiwal-mobile docs/design/SHARE_AND_QR.md §3.5): "QR code" —
 * the printable card the API makes (A6: the Hatiwal mark, the name, the QR to
 * the share link, "Scan to open in Hatiwal"), for a shop window, a counter or a
 * rickshaw sticker. The card's language is picked here (default: the page's),
 * since the shop owner may print a Pashto card from an English screen.
 *
 * Save image = the PNG; Print = the A6 PDF, which the browser prints at size.
 * Both load straight from Rails like photos (lib/share-link qrCardUrl).
 */
export function QrCardButton({
  kind,
  id,
  variant = "outline",
  className,
  iconOnly = false,
}: {
  kind: "listing" | "shop";
  id: number;
  variant?: ButtonProps["variant"];
  className?: string;
  /** A plain muted icon (a secondary action in a heading row, owner 2026-10: no text, no border). */
  iconOnly?: boolean;
}) {
  const t = useTranslations("qrCard");
  const locale = useLocale();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<ShareLang>(shareLang(locale) ?? "en");
  // The card's state, per language: a slow first render shows a placeholder, a 404 (a draft,
  // a sold listing) says so with Retry — never a collapsed box or a stale card.
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const png = qrCardUrl(kind, id, lang, "png");
  const pickLang = (l: ShareLang) => {
    setLang(l);
    setState("loading");
  };

  return (
    <>
      {iconOnly ? (
        <Button
          variant="ghost"
          size="icon"
          className={cn("size-11 text-muted-foreground", className)}
          onClick={() => setOpen(true)}
          aria-label={t("button")}
          title={t("button")}
          data-testid={`${kind}-qr-button`}
        >
          <QrCode className="size-5" />
        </Button>
      ) : (
        <Button variant={variant} className={className} onClick={() => setOpen(true)} data-testid={`${kind}-qr-button`}>
          <QrCode className="size-4" /> {t("button")}
        </Button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} labelledBy={titleId} className="flex max-h-[90vh] max-w-sm flex-col">
        <h2 id={titleId} className="text-lg font-semibold">
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
        <div role="radiogroup" aria-label={t("language")} className="mt-3 flex gap-2" data-testid="qr-card-lang">
          {SHARE_LANGS.map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={lang === l}
              onClick={() => pickLang(l)}
              className={cn(
                "min-h-11 rounded-full border px-4 text-sm",
                lang === l ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground",
              )}
            >
              {LOCALE_LABEL[l]}
            </button>
          ))}
        </div>
        <div
          className={cn("relative mt-3 aspect-[1240/1748] min-h-0 overflow-hidden rounded-lg border border-border", state === "ready" ? "bg-white" : "bg-muted")}
          aria-busy={state === "loading"}
        >
          {state === "loading" && <div className="absolute inset-0 animate-pulse bg-muted" data-testid="qr-card-loading" />}
          {state === "error" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center" data-testid="qr-card-error">
              <p className="text-sm text-foreground">{t("error")}</p>
              <Button variant="outline" onClick={() => { setState("loading"); setAttempt((a) => a + 1); }} data-testid="qr-card-retry">
                {t("retry")}
              </Button>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- a server-made card, not a photo to optimise
            <img
              key={`${png}#${attempt}`}
              src={attempt ? `${png}&r=${attempt}` : png}
              alt={t("alt")}
              width={1240}
              height={1748}
              onLoad={() => setState("ready")}
              onError={() => setState("error")}
              className={cn("h-full w-full object-contain", state === "ready" ? "opacity-100" : "opacity-0")}
              data-testid="qr-card-image"
            />
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button asChild variant="outline">
            {/* download=1: the API sends it as an attachment (a cross-origin `download` attribute is ignored). */}
            <a href={`${png}&download=1`} rel="noopener" download={`hatiwal-${kind}-${id}-${lang}.png`} data-testid="qr-card-png">
              <Download className="size-4" /> {t("download")}
            </a>
          </Button>
          <Button asChild>
            <a href={qrCardUrl(kind, id, lang, "pdf")} target="_blank" rel="noopener" data-testid="qr-card-pdf">
              <Printer className="size-4" /> {t("print")}
            </a>
          </Button>
        </div>
      </Dialog>
    </>
  );
}
