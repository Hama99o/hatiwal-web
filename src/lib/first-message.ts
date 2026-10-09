import { formatNumber, formatPrice } from "@/lib/format";

/**
 * The prefill of the "Contact Seller" message on a MULTI-UNIT listing (1.1.7,
 * parity with mobile's buildFirstMessageText, SF-M6): "Hi! I'd like to buy
 * 3 × AFN 400 = AFN 1,200. Is this still available?" — the quantity, unit price
 * and total in the reader's digits and currency, each bidi-isolated (FSI…PDI)
 * so an LTR amount cannot reorder around "×" / "=" in a ps / fa sentence.
 *
 * Empty for quantity 1, a single-item listing or no price: the dialog then
 * keeps its empty box and placeholder, as before.
 */
const isolate = (s: string) => `⁨${s}⁩`;

export function buildFirstMessage({
  units,
  multiUnit,
  unitPrice,
  currency,
  locale,
  t,
}: {
  units: number;
  multiUnit: boolean;
  unitPrice: number | null | undefined;
  currency: string | null | undefined;
  locale: string;
  t: (key: "listing.detail.firstMessageQuantityTemplate", values: Record<string, string>) => string;
}): string {
  if (!multiUnit || !Number.isFinite(units) || units <= 1) return "";
  if (!unitPrice || !Number.isFinite(unitPrice) || unitPrice <= 0) return "";
  return t("listing.detail.firstMessageQuantityTemplate", {
    qty: isolate(formatNumber(units, locale)),
    unitPrice: isolate(formatPrice(unitPrice, currency, locale)),
    total: isolate(formatPrice(unitPrice * units, currency, locale)),
  });
}
