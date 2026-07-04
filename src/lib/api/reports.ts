import { meRequest } from "./me";

// Mirrors the mobile reports contract (src/api/reports.ts) so a report filed
// from the web is identical to one from the app. Polymorphic: a Listing or User.
export type ReportableType = "Listing" | "User";

export type ReportReason =
  | "spam"
  | "inappropriate"
  | "fraud"
  | "wrong_category"
  | "prohibited_item"
  | "other";

export type ReportStatus = "pending" | "reviewed" | "resolved" | "dismissed";

/**
 * A report the current user submitted, as returned by GET /reports (list view).
 * Field names mirror the mobile Report contract field-for-field.
 */
export interface Report {
  id: number;
  reason: ReportReason;
  status: ReportStatus;
  /** Optional free-text note the reporter added. */
  description?: string;
  createdAt: string;
  reportableType: ReportableType;
  reportableId: number;
  /** Safe display label — listing title, user name, or "[deleted]". */
  reportableLabel: string;
}

export interface ReportsPagination {
  currentPage: number;
  nextPage: number | null;
  prevPage: number | null;
  totalCount: number;
  totalPages: number;
}

export interface MyReportsResponse {
  reports: Report[];
  pagination: ReportsPagination;
}

export interface CreateReportParams {
  reportableType: ReportableType;
  reportableId: number;
  reason: ReportReason;
  note?: string;
}

/**
 * Fetch the authenticated user's own reports, paginated (GET /reports).
 * Mirrors mobile reportsAPI.getMyReports. Rails responds with
 * `{ reports: [...], meta: { pagination: {...} } }` — meRequest camel-cases it.
 */
export async function getMyReports(page = 1): Promise<MyReportsResponse> {
  const query = new URLSearchParams({ "page[number]": String(page) });
  const data = await meRequest<{
    reports: Report[];
    meta: { pagination: ReportsPagination };
  }>(`reports?${query}`);
  return {
    reports: data.reports ?? [],
    pagination: data.meta.pagination,
  };
}

export async function createReport(params: CreateReportParams): Promise<void> {
  // Rails expects the params nested under `report`; meRequest snake-cases keys.
  await meRequest("reports", { method: "POST", json: { report: params } });
}
