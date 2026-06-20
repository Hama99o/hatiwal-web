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

export function convertKeysToCamel<T = unknown>(input: unknown): T {
  return convert(input, snakeToCamel) as T;
}

export function convertKeysToSnake<T = unknown>(input: unknown): T {
  return convert(input, camelToSnake) as T;
}
