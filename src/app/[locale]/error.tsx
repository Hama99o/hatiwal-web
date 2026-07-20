"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

// Localized error fallback. This lives under [locale]/layout.tsx, so the intl
// provider is available (an error boundary is nested inside its segment's
// layout and does not catch that layout's own errors).
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="size-7" />
      </div>
      <h1 className="text-xl font-bold">{t("errorTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("errorDescription")}</p>
      <Button onClick={reset}>{t("retry")}</Button>
    </div>
  );
}
