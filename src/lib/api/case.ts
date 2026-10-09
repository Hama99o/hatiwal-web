/**
 * Deep snake_case ⇄ camelCase conversion for API payloads — the web mirror of the
 * mobile app's convertKeysToCamel / convertKeysToSnake. Rails speaks snake_case;
 * the rest of the web app speaks camelCase.
 */

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

function camelToSnake(key: string): string {
  return key.replace(/([A-Z])/g, (c) => `_${c.toLowerCase()}`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function convert(value: unknown, mapKey: (k: string) => string): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => convert(v, mapKey));
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[mapKey(k)] = convert(v, mapKey);
    }
    return out;
  }
  return value;
}

// 1.1.6 photo variants (owner): every person block carries avatar_thumb_url
// (256px) beside avatar_url, a shop logo_thumb_url beside logo_url. Avatars and
// logos are only ever drawn small on the web, so the THUMB takes the familiar
// name here — once, for the 50+ call sites — and the original stays reachable
// as avatarOriginalUrl / logoOriginalUrl. An older API (no thumb) changes nothing.
const PREFER_THUMB: [thumb: string, field: string, original: string][] = [
  ["avatarThumbUrl", "avatarUrl", "avatarOriginalUrl"],
  ["logoThumbUrl", "logoUrl", "logoOriginalUrl"],
];

function preferThumbs(value: unknown): unknown {
  if (Array.isArray(value)) {
    value.forEach(preferThumbs);
    return value;
  }
  if (isPlainObject(value)) {
    for (const [thumb, field, original] of PREFER_THUMB) {
      if (typeof value[thumb] === "string" && value[thumb]) {
        value[original] = value[field] ?? null;
        value[field] = value[thumb];
      }
    }
    Object.values(value).forEach(preferThumbs);
  }
  return value;
}

export function convertKeysToCamel<T = unknown>(input: unknown): T {
  return preferThumbs(convert(input, snakeToCamel)) as T;
}

export function convertKeysToSnake<T = unknown>(input: unknown): T {
  return convert(input, camelToSnake) as T;
}
