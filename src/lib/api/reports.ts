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

export interface CreateReportParams {
  reportableType: ReportableType;
  reportableId: number;
  reason: ReportReason;
  note?: string;
}

export async function createReport(params: CreateReportParams): Promise<void> {
  // Rails expects the params nested under `report`; meRequest snake-cases keys.
  await meRequest("reports", { method: "POST", json: { report: params } });
}
