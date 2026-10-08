// Provinces the apps offer: all 34 of Afghanistan + Pakistan's 7, with names
// in every locale and capital coordinates. A PORT of
// hatiwal-mobile/src/data/afghan_provinces.ts (LOC-1) — the stored `value` must
// be the same string on both clients, or a province set on one would not be
// found on the other. Keep them in step.

export interface Province {
  value: string; // stored in the listing.location field
  en: string;
  ps: string;
  fa: string;
  /**
   * Urdu. Present on the PAKISTANI entries, which is where it matters — for the
   * Afghan ones `getProvinceName` falls back to `fa`, and that is a deliberate
   * choice rather than an omission: Dari and Urdu share the Arabic script and
   * the Afghan province names are spelled near-identically in both, so an Urdu
   * reader sees a name they recognise. Machine-transliterating 34 more strings
   * to look complete would add risk, not meaning.
   */
  ur?: string;
  /**
   * Extra strings the search should match. Pakistani provinces are commonly
   * written as initialisms — a seller types "KPK", not "Khyber Pakhtunkhwa",
   * and without this the picker would tell them their own province does not
   * exist. That is exactly the report that prompted this.
   */
  aliases?: string[];
  lat: number; // provincial capital latitude — attached to listings for map search
  lng: number; // provincial capital longitude
}

export const AFGHAN_PROVINCES: Province[] = [
  { value: "Kabul",       en: "Kabul",       ps: "کابل",      fa: "کابل",      lat: 34.5553, lng: 69.2075 },
  { value: "Kandahar",    en: "Kandahar",    ps: "کندهار",    fa: "قندهار",    lat: 31.6133, lng: 65.7101 },
  { value: "Herat",       en: "Herat",       ps: "هرات",      fa: "هرات",      lat: 34.3529, lng: 62.2040 },
  { value: "Nangarhar",   en: "Nangarhar",   ps: "ننگرهار",   fa: "ننگرهار",   lat: 34.4265, lng: 70.4515 },
  { value: "Balkh",       en: "Balkh",       ps: "بلخ",       fa: "بلخ",       lat: 36.7090, lng: 67.1109 },
  { value: "Kunduz",      en: "Kunduz",      ps: "کندز",      fa: "کندز",      lat: 36.7286, lng: 68.8681 },
  { value: "Ghazni",      en: "Ghazni",      ps: "غزني",      fa: "غزنی",      lat: 33.5492, lng: 68.4173 },
  { value: "Parwan",      en: "Parwan",      ps: "پروان",     fa: "پروان",     lat: 35.0136, lng: 69.1683 },
  { value: "Logar",       en: "Logar",       ps: "لوگر",      fa: "لوگر",      lat: 34.0015, lng: 69.0466 },
  { value: "Khost",       en: "Khost",       ps: "خوست",      fa: "خوست",      lat: 33.3395, lng: 69.9205 },
  { value: "Paktia",      en: "Paktia",      ps: "پکتیا",     fa: "پکتیا",     lat: 33.5970, lng: 69.2257 },
  { value: "Paktika",     en: "Paktika",     ps: "پکتیکا",    fa: "پکتیکا",    lat: 33.1761, lng: 68.7178 },
  { value: "Laghman",     en: "Laghman",     ps: "لغمان",     fa: "لغمان",     lat: 34.6680, lng: 70.2089 },
  { value: "Kunar",       en: "Kunar",       ps: "کنر",       fa: "کنر",       lat: 34.8742, lng: 71.1462 },
  { value: "Nuristan",    en: "Nuristan",    ps: "نورستان",   fa: "نورستان",   lat: 35.4264, lng: 70.9181 },
  { value: "Badakhshan",  en: "Badakhshan",  ps: "بدخشان",    fa: "بدخشان",    lat: 37.1166, lng: 70.5800 },
  { value: "Takhar",      en: "Takhar",      ps: "تخار",      fa: "تخار",      lat: 36.7361, lng: 69.5345 },
  { value: "Baghlan",     en: "Baghlan",     ps: "بغلان",     fa: "بغلان",     lat: 35.9482, lng: 68.7150 },
  { value: "Samangan",    en: "Samangan",    ps: "سمنگان",    fa: "سمنگان",    lat: 36.2659, lng: 68.0150 },
  { value: "Sar-e Pol",   en: "Sar-e Pol",   ps: "سرپل",      fa: "سرپل",      lat: 36.2159, lng: 65.9333 },
  { value: "Jawzjan",     en: "Jawzjan",     ps: "جوزجان",    fa: "جوزجان",    lat: 36.6657, lng: 65.7529 },
  { value: "Faryab",      en: "Faryab",      ps: "فاریاب",    fa: "فاریاب",    lat: 35.9211, lng: 64.7842 },
  { value: "Badghis",     en: "Badghis",     ps: "بادغیس",    fa: "بادغیس",    lat: 34.9853, lng: 63.1287 },
  { value: "Ghor",        en: "Ghor",        ps: "غور",       fa: "غور",       lat: 34.5267, lng: 65.2680 },
  { value: "Daykundi",    en: "Daykundi",    ps: "دایکندی",   fa: "دایکندی",   lat: 33.7220, lng: 66.1300 },
  { value: "Bamyan",      en: "Bamyan",      ps: "بامیان",    fa: "بامیان",    lat: 34.8210, lng: 67.8270 },
  { value: "Wardak",      en: "Wardak",      ps: "وردک",      fa: "وردک",      lat: 34.3961, lng: 68.8669 },
  { value: "Zabul",       en: "Zabul",       ps: "زابل",      fa: "زابل",      lat: 32.1058, lng: 66.9070 },
  { value: "Uruzgan",     en: "Uruzgan",     ps: "ارزگان",    fa: "ارزگان",    lat: 32.6266, lng: 65.8694 },
  { value: "Helmand",     en: "Helmand",     ps: "هلمند",     fa: "هلمند",     lat: 31.5938, lng: 64.3715 },
  { value: "Nimroz",      en: "Nimroz",      ps: "نیمروز",    fa: "نیمروز",    lat: 31.0125, lng: 61.8628 },
  { value: "Farah",       en: "Farah",       ps: "فراه",      fa: "فراه",      lat: 32.3742, lng: 62.1135 },
  { value: "Kapisa",      en: "Kapisa",      ps: "کاپیسا",    fa: "کاپیسا",    lat: 34.9810, lng: 69.3220 },
  { value: "Panjshir",    en: "Panjshir",    ps: "پنجشیر",    fa: "پنجشیر",    lat: 35.3105, lng: 69.5400 },
  // ── Pakistan's provinces and territories ────────────────────────────────────
  //
  // Added 2026-09-14 after the owner reported that KPK — a province of a country
  // whose map and currency we already ship — could not be picked at all.
  //
  // Seven entries covers ALL of Pakistan: four provinces, the capital territory,
  // and the two administered territories. Coordinates are each unit's capital,
  // matching the Afghan rows and what `nearestProvince` compares against.
  //
  // NO COUNTRY NAME IS RENDERED ANYWHERE, and no `country` field exists on the
  // rows — an earlier draft added one and it was removed on the owner's
  // instruction. The list the seller sees is one flat set of places they can
  // pick from, with no grouping and no headers.
  { value: "Punjab",             en: "Punjab",             ps: "پنجاب",          fa: "پنجاب",          ur: "پنجاب", aliases: ["PB"],              lat: 31.5204, lng: 74.3587 },
  { value: "Sindh",              en: "Sindh",              ps: "سند",            fa: "سند",            ur: "سندھ", aliases: ["SD"],              lat: 24.8607, lng: 67.0011 },
  { value: "Khyber Pakhtunkhwa", en: "Khyber Pakhtunkhwa", ps: "خیبر پښتونخوا",  fa: "خیبر پختونخوا",  ur: "خیبر پختونخوا", aliases: ["KPK", "KP", "NWFP", "Pakhtunkhwa"], lat: 34.0151, lng: 71.5249 },
  { value: "Balochistan",        en: "Balochistan",        ps: "بلوچستان",       fa: "بلوچستان",       ur: "بلوچستان", aliases: ["BL"],              lat: 30.1798, lng: 66.9750 },
  { value: "Islamabad",          en: "Islamabad",          ps: "اسلام آباد",     fa: "اسلام‌آباد",     ur: "اسلام آباد", aliases: ["ICT", "Capital Territory"], lat: 33.6844, lng: 73.0479 },
  { value: "Gilgit-Baltistan",   en: "Gilgit-Baltistan",   ps: "ګلګت بلتستان",   fa: "گلگت بلتستان",   ur: "گلگت بلتستان", aliases: ["GB", "Gilgit"],    lat: 35.9208, lng: 74.3082 },
  { value: "Azad Kashmir",       en: "Azad Kashmir",       ps: "آزاد کشمیر",     fa: "آزاد کشمیر",     ur: "آزاد جموں و کشمیر", aliases: ["AJK", "Kashmir"],  lat: 34.3700, lng: 73.4711 },
];

export function getProvinceName(
  province: Province,
  lang: string
): string {
  if (lang === "ps") return province.ps;
  if (lang === "fa") return province.fa;
  // Urdu falls back to Dari for the Afghan rows on purpose — same script, and
  // the names are spelled near-identically, so the reader recognises them.
  if (lang === "ur") return province.ur || province.fa;
  return province.en;
}

export function getProvinceByValue(value?: string | null): Province | undefined {
  if (!value) return undefined;
  return AFGHAN_PROVINCES.find((p) => p.value === value);
}

export function nearestProvince(lat: number, lng: number): Province | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const rad = (d: number) => (d * Math.PI) / 180;
  let best: Province | null = null;
  let bestD = Infinity;
  for (const p of AFGHAN_PROVINCES) {
    const dLat = lat - p.lat;
    const dLng = (lng - p.lng) * Math.cos(rad((lat + p.lat) / 2));
    const d = dLat * dLat + dLng * dLng;
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

/**
 * A listing card's location (parity with mobile `shortLocation`, 12e1bbc): the
 * geocoded string without parts that repeat an earlier one ("10th District,
 * Kabul, Kabul District" → "10th District, Kabul"), at most `maxParts`, and a
 * part that IS a province name in the reader's language ("Kabul" → "کابل" on
 * /ps and /fa; design QA 1.1.6). Districts and streets stay as geocoded.
 */
export function cardLocation(location: string | null | undefined, lang: string, maxParts = 2): string | null {
  if (!location) return null;
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const part of location.split(/\s*[,،]\s*/).map((p) => p.trim()).filter(Boolean)) {
    const key = part
      .toLowerCase()
      .replace(/\b(district|province)\b/g, "")
      .replace(/(ولسوالی|ولسوالۍ|ولایت|ناحیه|ناحیې)/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (key && seen.has(key)) continue;
    seen.add(key);
    kept.push(part);
  }
  const shown = kept.slice(0, maxParts).map((part) => {
    if (lang === "en") return part;
    const lower = part.toLowerCase();
    const province = AFGHAN_PROVINCES.find((p) => p.value.toLowerCase() === lower || p.en.toLowerCase() === lower);
    return province ? getProvinceName(province, lang) : part;
  });
  return shown.join(lang !== "en" ? "، " : ", ") || null;
}
