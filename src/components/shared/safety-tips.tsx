"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ShieldCheck,
  Users,
  Sun,
  UserPlus,
  Eye,
  Ban,
  Sparkles,
  Flag,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

// Ordered tip keys — must match `safety.tips.*` in all 3 locale files. Mirrors
// the mobile SafetyTipsSheet.
const TIPS: { key: string; icon: LucideIcon }[] = [
  { key: "publicPlace", icon: Users },
  { key: "daylight", icon: Sun },
  { key: "bringFriend", icon: UserPlus },
  { key: "inspectItem", icon: Eye },
  { key: "noAdvancePayment", icon: Ban },
  { key: "trustInstincts", icon: Sparkles },
  { key: "reportSuspicious", icon: Flag },
];

/**
 * Meetup safety guidance — Hatiwal has no online payment or delivery, so every
 * deal is completed in person. A quiet trigger opens a modal of icon-led tips.
 * Surfaced on the listing detail and inside the chat meetup flow, mirroring the
 * mobile SafetyTipsSheet. `variant="short"` uses the compact link label.
 */
export function SafetyTips({
  variant = "full",
  className,
}: {
  variant?: "full" | "short";
  className?: string;
}) {
  const t = useTranslations("safety");
  const [open, setOpen] = useState(false);
  const titleId = useId();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline ${className ?? ""}`}
      >
        <ShieldCheck className="size-4 shrink-0 text-success" />
        {t(variant === "short" ? "linkShort" : "link")}
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        labelledBy={titleId}
        className="max-h-[85vh] max-w-md overflow-y-auto"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <h2 id={titleId} className="text-lg font-semibold">
              {t("title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("subtitle")}
            </p>
          </div>
        </div>

        <ul className="mt-4 space-y-3">
          {TIPS.map(({ key, icon: Icon }) => (
            <li key={key} className="flex items-start gap-3">
              <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span className="text-sm text-foreground">{t(`tips.${key}`)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex justify-end">
          <Button onClick={() => setOpen(false)}>{t("close")}</Button>
        </div>
      </Dialog>
    </>
  );
}
