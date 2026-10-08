"use client";

import { useTranslations } from "next-intl";
import { PackageX, TriangleAlert, WifiOff, type LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { describeApiError, isNetworkFailure, isNotFound } from "@/lib/api/error-codes";

/**
 * The error state of a client-loaded RESOURCE view (a query that failed):
 *  - 404 → `notFoundTitle` ("no longer available") + the way back;
 *  - anything else → "Something went wrong" + why (offline / 429 / try again)
 *    + Retry.
 * Replaces a bare `common.error` ("Error") with no exit (error sweep, 1.1.6).
 */
export function QueryErrorState({
  error,
  onRetry,
  notFoundTitle,
  notFoundIcon = PackageX,
  backHref,
  backLabel,
  className,
}: {
  error: unknown;
  onRetry: () => void;
  notFoundTitle: string;
  notFoundIcon?: LucideIcon;
  backHref: string;
  backLabel: string;
  className?: string;
}) {
  const t = useTranslations();
  if (isNotFound(error)) {
    return (
      <EmptyState
        icon={notFoundIcon}
        title={notFoundTitle}
        action={{ label: backLabel, href: backHref }}
        className={className}
      />
    );
  }
  return (
    <EmptyState
      icon={isNetworkFailure(error) ? WifiOff : TriangleAlert}
      title={t("common.errorTitle")}
      description={describeApiError(error, t, { fallbackKey: "common.errorDescription" })}
      action={{ label: t("common.retry"), onClick: onRetry }}
      className={className}
    />
  );
}
