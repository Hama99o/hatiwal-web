import { meRequest } from "./me";

/**
 * VER-1: apply for the Verified badge. Same endpoints and shapes as mobile
 * (hatiwal-mobile src/api/verification.ts). The API never returns a document,
 * only the status card.
 */
export type VerificationState = "none" | "requested" | "verified" | "rejected" | "revoked";
export type VerificationDocumentType = "tazkira" | "e_tazkira" | "cnic" | "kart_melli" | "passport";
export type VerificationMissing = "email_confirmed" | "avatar" | "full_name";

export const VERIFICATION_DOCUMENT_TYPES: VerificationDocumentType[] = [
  "tazkira",
  "e_tazkira",
  "cnic",
  "kart_melli",
  "passport",
];
/** Documents with a back side (mirrors VerificationRequest::TWO_SIDED). */
export const TWO_SIDED_DOCUMENTS: VerificationDocumentType[] = ["e_tazkira", "cnic", "kart_melli"];
/** Same cap as the API (VerificationRequest::MAX_FILE_SIZE). */
export const MAX_VERIFICATION_PHOTO_BYTES = 10 * 1024 * 1024;

export interface VerificationRequestSummary {
  id: number;
  status: "requested" | "rejected" | "revoked";
  documentType: VerificationDocumentType | null;
  nameOnDocument: string | null;
  documentLast4: string | null;
  filesCount: number;
  reasonCode: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface VerificationStatus {
  status: VerificationState;
  verifiedSince: string | null;
  missing: VerificationMissing[];
  reason: string | null;
  request: VerificationRequestSummary | null;
}

export interface VerificationApplication {
  documentType: VerificationDocumentType;
  nameOnDocument: string;
  documentLast4: string;
  front: Blob;
  back?: Blob | null;
  selfie: Blob;
}

export const VERIFICATION_QK = ["verification-status"] as const;

function toStatus(d: { verificationStatus: VerificationStatus }): VerificationStatus {
  const s = d.verificationStatus;
  return { ...s, missing: s.missing ?? [], request: s.request ?? null };
}

export async function getVerificationStatus(): Promise<VerificationStatus> {
  return toStatus(await meRequest("verification_requests/current?subject=me"));
}

export async function applyForVerification(app: VerificationApplication): Promise<VerificationStatus> {
  const form = new FormData();
  form.append("verification_request[document_type]", app.documentType);
  form.append("verification_request[name_on_document]", app.nameOnDocument.trim());
  form.append("verification_request[document_last4]", app.documentLast4);
  form.append("verification_request[front]", app.front, "front.jpg");
  if (app.back) form.append("verification_request[back]", app.back, "back.jpg");
  form.append("verification_request[selfie]", app.selfie, "selfie.jpg");
  return toStatus(await meRequest("verification_requests", { form }));
}

export async function cancelVerification(id: number): Promise<VerificationStatus> {
  return toStatus(await meRequest(`verification_requests/${id}`, { method: "DELETE" }));
}

/** The reason in the reader's language; "other" is the admin's own words. */
export function verificationReasonKey(status: VerificationStatus): string | null {
  const code = status.request?.reasonCode;
  return code && code !== "other" ? `reasons.${code}` : null;
}

/** Persian/Arabic-Indic digits → ASCII digits only. */
export function normalizeLast4(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/\D/g, "")
    .slice(0, 4);
}
