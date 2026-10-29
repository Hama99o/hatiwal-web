import { test, expect } from "@playwright/test";
import { ApiError } from "../src/lib/api/client";
import {
  IMAGE_SEARCH_MAX_BYTES,
  imageSearchErrorKey,
  precheckPhoto,
} from "../src/lib/api/image-search";
import { shrunkSize, SHRINK_MAX_SIDE } from "../src/lib/image-search/shrink-photo";
import { getPendingPhoto, setPendingPhoto } from "../src/lib/image-search/pending-photo";

/**
 * Unit checks for search by image's pure helpers (hatiwal-api
 * docs/IMAGE_SEARCH.md). No page, no server: Playwright is this repo's only
 * runner (see seo-unit.spec.ts).
 */

test.describe("imageSearchErrorKey: every refusal gets its own translated message", () => {
  test("Rails' codes", () => {
    expect(imageSearchErrorKey(new ApiError(422, "x", [], "invalid_image"))).toBe("invalidImage");
    expect(imageSearchErrorKey(new ApiError(422, "x", [], "image_missing"))).toBe("invalidImage");
    expect(imageSearchErrorKey(new ApiError(422, "x", [], "image_too_large"))).toBe("tooLarge");
    expect(imageSearchErrorKey(new ApiError(503, "x", [], "image_search_unavailable"))).toBe("unavailable");
  });

  test("statuses without a code", () => {
    expect(imageSearchErrorKey(new ApiError(429, "x", ["rate_limited"]))).toBe("rateLimited");
    expect(imageSearchErrorKey(new ApiError(503, "x"))).toBe("unavailable");
    expect(imageSearchErrorKey(new ApiError(502, "x"))).toBe("offline");
    expect(imageSearchErrorKey(new ApiError(500, "x"))).toBe("generic");
  });

  test("a fetch that never got a response is offline", () => {
    expect(imageSearchErrorKey(new TypeError("Failed to fetch"))).toBe("offline");
  });
});

test.describe("precheckPhoto: refused before any upload", () => {
  test("a photo under the cap passes; HEIC with no browser type is left to the server", () => {
    expect(precheckPhoto({ type: "image/jpeg", size: 200_000 })).toBeNull();
    expect(precheckPhoto({ type: "", size: 200_000 })).toBeNull();
  });

  test("not an image, or over 10 MB", () => {
    expect(precheckPhoto({ type: "application/pdf", size: 1_000 })).toBe("invalidImage");
    expect(precheckPhoto({ type: "image/png", size: IMAGE_SEARCH_MAX_BYTES + 1 })).toBe("tooLarge");
  });
});

test.describe("shrunkSize: the upload is at most SHRINK_MAX_SIDE on its long side", () => {
  test("a big landscape and portrait photo keep their shape", () => {
    expect(shrunkSize(4000, 3000)).toEqual({ width: SHRINK_MAX_SIDE, height: 768 });
    expect(shrunkSize(3000, 4000)).toEqual({ width: 768, height: SHRINK_MAX_SIDE });
  });

  test("a small photo is never enlarged", () => {
    expect(shrunkSize(640, 480)).toEqual({ width: 640, height: 480 });
  });
});

test.describe("pending photo: handed to the results page in memory", () => {
  test("only the current pick's id finds it", () => {
    const first = setPendingPhoto(new Blob(["a"], { type: "image/jpeg" }));
    expect(getPendingPhoto(first.id)?.photo.size).toBe(1);

    const second = setPendingPhoto(new Blob(["bb"], { type: "image/jpeg" }));
    expect(second.id).not.toBe(first.id);
    expect(getPendingPhoto(first.id)).toBeNull();
    expect(getPendingPhoto(second.id)?.photo.size).toBe(2);
    expect(getPendingPhoto(null)).toBeNull();
  });
});
