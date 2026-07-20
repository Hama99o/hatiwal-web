"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles, Store, Handshake, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useAuth } from "@/components/auth/auth-provider";

const STORAGE_KEY = "hatiwal.onboarded";

const POINTS: { key: string; icon: LucideIcon }[] = [
  { key: "modes", icon: Store },
  { key: "meetups", icon: Handshake },
];

/**
 * First-run welcome modal (mobile onboarding parity, adapted for the web's
 * SEO-first shape). Shown ONCE to a logged-in user who hasn't seen it — a
 * localStorage flag gates it, so it never nags. Explains the model (local,
 * buy+sell, meet in person, no payment) and points at the Bazaar.
 */
export function OnboardingModal() {
  const t = useTranslations("onboarding");
  const { status } = useAuth();
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (status !== "authed") return;
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) setOpen(true);
    } catch {
      /* storage unavailable — just don't show it */
    }
  }, [status]);

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onClose={dismiss}
      labelledBy={titleId}
      className="max-w-md space-y-4"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="size-5" />
        </span>
        <div>
          <h2 id={titleId} className="text-lg font-semibold">
            {t("title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      <ul className="space-y-3">
        {POINTS.map(({ key, icon: Icon }) => (
          <li key={key} className="flex items-start gap-3">
            <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium">{t(`points.${key}.title`)}</p>
              <p className="text-xs text-muted-foreground">
                {t(`points.${key}.description`)}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex justify-end">
        <Button onClick={dismiss}>{t("getStarted")}</Button>
      </div>
    </Dialog>
  );
}
