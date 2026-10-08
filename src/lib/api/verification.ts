import { meRequest } from "./me";

/**
 * VER-1: apply for the Verified badge. Same endpoints and shapes as mobile
 * (hatiwal-mobile src/api/verification.ts). The API never returns a document,
 * only the status card.
 */
export type VerificationState = "none" | "requested" | "verified" | "rejected" | "revoked";
export type VerificationDocumentType = "tazkira" | "e_tazkira" | "cnic" | "kart_melli" | "passport";
export type VerificationMissing = "email_confirmed" | "avatar" | "full_name" | "logo" | "location" | "live_product";

/** "me", or a shop the caller manages (SHOP-1 verified shops). */
export type VerificationSubject = "me" | `shop:${number}`;
/** Owner, 2026-10-05: ONLY the e-Tazkira is accepted (the server refuses the rest). */
export const VERIFICATION_DOCUMENT_TYPES: VerificationDocumentType[] = ["e_tazkira"];
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
  /** The photos were deleted after the 90-day retention (api). */
  filesPurged?: boolean;
  reasonCode: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface VerificationStatus {
  status: VerificationState;
  verifiedSince: string | null;
  missing: VerificationMissing[];
  reason: string | null;
  /** The badge came off because the name changed after approval: "verify again". */
  nameChanged: boolean;
  request: VerificationRequestSummary | null;
  /** May THIS viewer apply? false for a shop's staff. Absent (older API) = true. */
  canApply: boolean;
}

export interface VerificationApplication {
  /** "me" (default) or `shop:<id>`: a shop sends the owner's form + `proof`. */
  subject?: VerificationSubject;
  documentType: VerificationDocumentType;
  nameOnDocument: string;
  /** The full number; the API keeps it encrypted and never returns it. */
  documentNumber: string;
  front: Blob;
  back?: Blob | null;
  selfie: Blob;
  /** Shops only (required there): proof that the business is theirs: licence, rental contract, tax paper… */
  proof?: Blob | null;
}

export const VERIFICATION_QK = ["verification-status"] as const;

function toStatus(d: { verificationStatus: VerificationStatus }): VerificationStatus {
  const s = d.verificationStatus;
  return { ...s, missing: s.missing ?? [], nameChanged: s.nameChanged ?? false, request: s.request ?? null, canApply: s.canApply ?? true };
}

export async function getVerificationStatus(subject: VerificationSubject = "me"): Promise<VerificationStatus> {
  return toStatus(await meRequest(`verification_requests/current?subject=${subject}`));
}

export const shopVerificationQK = (shopId: number) => ["verification-status", `shop:${shopId}`] as const;

/**
 * Send the request. A shop (SHOP-1) sends exactly the person's fields +
 * `subject` + the `proof` photo (owner, 2026-10-05: no shop front, no phone).
 */
export async function applyForVerification(app: VerificationApplication): Promise<VerificationStatus> {
  const form = new FormData();
  if (app.subject && app.subject !== "me") form.append("subject", app.subject);
  form.append("verification_request[document_type]", app.documentType);
  form.append("verification_request[name_on_document]", app.nameOnDocument.trim());
  form.append("verification_request[document_number]", app.documentNumber);
  form.append("verification_request[front]", app.front, "front.jpg");
  if (app.back) form.append("verification_request[back]", app.back, "back.jpg");
  form.append("verification_request[selfie]", app.selfie, "selfie.jpg");
  if (app.proof) form.append("verification_request[proof]", app.proof, "proof.jpg");
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

/** Letters and digits, at least one digit, 5–20 characters (no invented official formats). */
export const isValidDocumentNumber = (value: string) => /^(?=.*\d)[0-9A-Z]{5,20}$/.test(value);

/**
 * A document number as stored: ASCII digits + upper-case letters (owner,
 * 2026-10-05). Persian/Arabic-Indic digits become ASCII; spaces, dashes and
 * other marks are dropped; at most 20. Mirrors the API's normalize_number.
 */
export function normalizeDocumentNumber(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .slice(0, 20);
}

/** Browser key of the apply flow's saved progress (never holds a photo). */
export const VERIFICATION_DRAFT_KEY = "hatiwal.verification-draft";
/** A shop's draft is kept apart from the person's, one per shop. */
export const verificationDraftKey = (shopId?: number) => (shopId ? `${VERIFICATION_DRAFT_KEY}.shop-${shopId}` : VERIFICATION_DRAFT_KEY);

/** Forget every saved progress (the person's and each shop's) — on logout, so a shared computer never shows it. */
export function clearVerificationDraft(): void {
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const key = window.localStorage.key(i);
      if (key && (key === VERIFICATION_DRAFT_KEY || key.startsWith(`${VERIFICATION_DRAFT_KEY}.`))) window.localStorage.removeItem(key);
    }
  } catch {
    /* storage unavailable: nothing was saved */
  }
}
