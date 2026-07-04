"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Flag } from "lucide-react";
import {
  getMyReports,
  type Report,
  type ReportStatus,
} from "@/lib/api/reports";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";

// Report status → semantic Badge variant. Mirrors the mobile ReportStatusBadge
// token grammar: pending/dismissed neutral, reviewed info, resolved success.
const STATUS_VARIANT: Record<
  ReportStatus,
  "muted" | "default" | "success"
> = {
  pending: "muted",
  reviewed: "default",
  resolved: "success",
  dismissed: "muted",
};

function ReportStatusBadge({ status }: { status: ReportStatus }) {
  const t = useTranslations("report.status");
  return <Badge variant={STATUS_VARIANT[status]}>{t(status)}</Badge>;
}

function ReportRow({ report }: { report: Report }) {
  const t = useTranslations("report");
  const locale = useLocale();

  return (
    <li className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-sm font-semibold text-foreground">
          {t(`reasons.${report.reason}`)}
        </span>
        <ReportStatusBadge status={report.status} />
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
        {report.reportableLabel}
      </p>
      {report.description && (
        <p className="mt-2 line-clamp-3 text-sm text-foreground/80">
          {report.description}
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        {t("myReports.reportedOn", { date: formatDate(report.createdAt, locale) })}
      </p>
    </li>
  );
}

function ReportRowSkeleton() {
  return (
    <li className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="mt-2 h-4 w-3/4" />
      <Skeleton className="mt-2 h-3 w-24" />
    </li>
  );
}

export function MyReportsView() {
  const t = useTranslations();

  const query = useInfiniteQuery({
    queryKey: ["my-reports"],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => getMyReports(pageParam),
    getNextPageParam: (last) => last.pagination.nextPage ?? undefined,
  });

  const reports = query.data?.pages.flatMap((p) => p.reports) ?? [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">
        {t("report.myReports.title")}
      </h1>

      {query.isError ? (
        <div className="flex flex-col items-center gap-4">
          <EmptyState icon={Flag} title={t("common.error")} />
          <Button variant="outline" onClick={() => query.refetch()}>
            {t("common.retry")}
          </Button>
        </div>
      ) : query.isPending ? (
        <ul className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <ReportRowSkeleton key={i} />
          ))}
        </ul>
      ) : reports.length === 0 ? (
        <EmptyState icon={Flag} title={t("report.myReports.empty")} />
      ) : (
        <>
          <ul className="space-y-3">
            {reports.map((r) => (
              <ReportRow key={r.id} report={r} />
            ))}
          </ul>
          {query.hasNextPage && (
            <div className="mt-6 flex justify-center">
              <Button
                variant="outline"
                disabled={query.isFetchingNextPage}
                onClick={() => query.fetchNextPage()}
              >
                {query.isFetchingNextPage
                  ? t("common.loading")
                  : t("common.loadMore")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
