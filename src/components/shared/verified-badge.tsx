import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

// Lucide's BadgeCheck geometry, drawn FILLED: a solid brand-blue rosette with
// a white check — the pattern people already read as "verified", and the same
// badge as mobile (src/components/common/VerifiedBadge.tsx). `--primary` is a
// saturated blue in light and dark, with a white foreground in both.
const ROSETTE =
  "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z";

export function VerifiedBadge({
  withLabel = false,
  className,
}: {
  withLabel?: boolean;
  className?: string;
}) {
  const t = useTranslations("common");
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-primary", className)}
      title={t("verified")}
    >
      <svg viewBox="0 0 24 24" className="size-4 shrink-0" aria-hidden="true">
        <path
          d={ROSETTE}
          fill="currentColor"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        <path
          d="m8.6 12.2 2.3 2.3 4.6-4.8"
          fill="none"
          stroke="var(--primary-foreground)"
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {withLabel && (
        <span className="text-xs font-medium">{t("verified")}</span>
      )}
    </span>
  );
}
