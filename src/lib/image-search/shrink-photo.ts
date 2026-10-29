/**
 * Search by image: shrink the buyer's photo in the browser before it is sent.
 * The server only looks at a 224×224 version (CLIP's input), so a 6 MB phone
 * photo becomes a ~150 KB JPEG and the search starts in a moment instead of
 * after a long upload on a mobile connection.
 *
 * Anything the browser cannot decode (HEIC outside Safari) is sent as it is:
 * the server reads HEIC itself.
 */
export const SHRINK_MAX_SIDE = 1024;

export async function shrinkPhoto(file: Blob): Promise<Blob> {
  if (typeof createImageBitmap !== "function") return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }
  try {
    const { width, height } = shrunkSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    // A transparent PNG flattens on white, like the server does.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/jpeg", 0.85));
    return blob && blob.size < file.size ? blob : file;
  } finally {
    bitmap.close();
  }
}

/** The size that fits SHRINK_MAX_SIDE, keeping the shape; never upscales. */
export function shrunkSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, SHRINK_MAX_SIDE / Math.max(width, height, 1));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
