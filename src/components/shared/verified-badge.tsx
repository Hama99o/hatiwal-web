import { useTranslations } from "next-intl";
import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

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
      <BadgeCheck className="size-4" />
      {withLabel && (
        <span className="text-xs font-medium">{t("verified")}</span>
      )}
    </span>
  );
}
