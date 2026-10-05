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
/** What a SHOP may show as its ID/licence (licence first). */
export const SHOP_DOCUMENT_TYPES = ["licence", "tazkira", "e_tazkira", "cnic", "kart_melli", "passport"] as const;
export type ShopDocumentType = (typeof SHOP_DOCUMENT_TYPES)[number];

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
  /** The badge came off because the name changed after approval: "verify again". */
  nameChanged: boolean;
  request: VerificationRequestSummary | null;
}

export interface VerificationApplication {
  documentType: VerificationDocumentType;
  nameOnDocument: string;
  /** The full number; the API keeps it encrypted and never returns it. */
  documentNumber: string;
  front: Blob;
  back?: Blob | null;
  selfie: Blob;
}

export const VERIFICATION_QK = ["verification-status"] as const;

function toStatus(d: { verificationStatus: VerificationStatus }): VerificationStatus {
  const s = d.verificationStatus;
  return { ...s, missing: s.missing ?? [], nameChanged: s.nameChanged ?? false, request: s.request ?? null };
}

export async function getVerificationStatus(subject: VerificationSubject = "me"): Promise<VerificationStatus> {
  return toStatus(await meRequest(`verification_requests/current?subject=${subject}`));
}

/** SHOP-1: apply for "Verified shop" (front = shop front, back = ID/licence). */
export async function applyForShopVerification(app: {
  shopId: number;
  documentType: ShopDocumentType;
  documentNumber?: string;
  phone: string;
  shopFront: Blob;
  document: Blob;
}): Promise<VerificationStatus> {
  const form = new FormData();
  form.append("subject", `shop:${app.shopId}`);
  form.append("verification_request[document_type]", app.documentType);
  form.append("verification_request[phone]", app.phone.trim());
  if (app.documentNumber) form.append("verification_request[document_number]", app.documentNumber);
  form.append("verification_request[front]", app.shopFront, "front.jpg");
  form.append("verification_request[back]", app.document, "back.jpg");
  return toStatus(await meRequest("verification_requests", { form }));
}

export const shopVerificationQK = (shopId: number) => ["verification-status", `shop:${shopId}`] as const;

export async function applyForVerification(app: VerificationApplication): Promise<VerificationStatus> {
  const form = new FormData();
  form.append("verification_request[document_type]", app.documentType);
  form.append("verification_request[name_on_document]", app.nameOnDocument.trim());
  form.append("verification_request[document_number]", app.documentNumber);
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
/** Digits only, a sensible length (no invented official formats): 6–20. */
export const isValidDocumentNumber = (value: string) => /^\d{6,20}$/.test(value);

/** Persian/Arabic-Indic digits → ASCII digits only, at most 20. */
export function normalizeDocumentNumber(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/\D/g, "")
    .slice(0, 20);
}

/** Browser key of the apply flow's saved progress (never holds a photo). */
export const VERIFICATION_DRAFT_KEY = "hatiwal.verification-draft";

/** Forget the saved progress — on logout, so a shared computer never shows it. */
export function clearVerificationDraft(): void {
  try {
    window.localStorage.removeItem(VERIFICATION_DRAFT_KEY);
  } catch {
    /* storage unavailable: nothing was saved */
  }
}
