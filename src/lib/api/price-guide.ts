import { apiGet } from "./client";

// Mirrors the mobile contract (src/api/price-guide.ts). IDEA-4: what similar
// items sold for — a P25–P75 range per subcategory + currency, published only
// with enough sales from enough sellers; otherwise only `available: false`.
export type PriceGuide =
  | { available: false }
  | { available: true; low: number; high: number; count: number; currency: string; windowDays: number };

export async function getPriceGuide(categoryId: number, currency: string): Promise<PriceGuide> {
  const data = await apiGet<{ priceGuide?: PriceGuide }>("price_guide", { params: { category_id: categoryId, currency } });
  return data.priceGuide ?? { available: false };
}
