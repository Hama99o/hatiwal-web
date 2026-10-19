/**
 * VID (1.1.9, docs/LISTING_VIDEO.md, Web) — the ONE adapter around in-browser
 * video work, the web twin of the app's src/lib/listingVideo.ts:
 *
 *   - read a picked file's facts (duration / size) from a <video> element;
 *   - cut the 60 s window AND compress to the app's target (720p — long edge
 *     1280 — H.264 + AAC, ~2 Mbit/s, MP4 with faststart) in ONE pass with
 *     WebCodecs, through Mediabunny (loaded on demand, never in the main bundle);
 *   - grab a poster frame (canvas → JPEG).
 *
 * Owner rule: never a "too big, compress it" error. The only refusal is the
 * rare browser WITHOUT WebCodecs H.264 + AAC encoding, and then only when the
 * file cannot go up as it is (over 60 s, or over 25 MB): the seller is told to
 * use the app (`video_needs_app`).
 */

export const MAX_VIDEO_DURATION_S = 60;
/** The server's hard cap (Listing::MAX_VIDEO_SIZE). */
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
export const TARGET_LONG_EDGE = 1280;
export const TARGET_VIDEO_BITRATE = 2_000_000;
const TARGET_AUDIO_BITRATE = 128_000;
const PASSTHROUGH_MAX_BITRATE = 2_600_000;

export interface VideoInfo {
  durationS: number;
  width: number;
  height: number;
  sizeBytes: number;
  type: string;
}

/** The part to keep, in seconds of the source. */
export interface VideoWindow {
  startS: number;
  endS: number;
}

export interface PreparedVideo {
  blob: Blob;
  poster: Blob | null;
  durationS: number;
  reencoded: boolean;
}

export class VideoNeedsAppError extends Error {
  constructor() {
    super("video_needs_app");
  }
}

/** Duration and size from the browser's own decoder — works without WebCodecs. */
export function getVideoInfo(file: Blob): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => {
      resolve({
        durationS: Number.isFinite(v.duration) ? v.duration : 0,
        width: v.videoWidth,
        height: v.videoHeight,
        sizeBytes: file.size,
        type: file.type,
      });
      URL.revokeObjectURL(url);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("video_unreadable"));
    };
    v.src = url;
  });
}

/**
 * A file this browser cannot even read (H.264 in a codec-less Chromium, HEVC
 * .mov in Firefox) can still go up untouched when it is a phone video format
 * and under the server cap — the server's own checks still apply.
 */
export function canUploadUnread(file: Blob): boolean {
  return /^video\/(mp4|quicktime)$/i.test(file.type) && file.size <= MAX_VIDEO_BYTES;
}

export function needsTrim(durationS: number): boolean {
  return durationS > MAX_VIDEO_DURATION_S + 0.5;
}

export function defaultWindow(durationS: number): VideoWindow {
  return { startS: 0, endS: Math.min(durationS, MAX_VIDEO_DURATION_S) };
}

/** A small 720p MP4 that needs no encode (no upscale, no re-encode for nothing). */
export function canPassThrough(info: VideoInfo, win: VideoWindow): boolean {
  const whole = win.startS <= 0 && win.endS >= info.durationS - 0.5;
  if (!whole || info.durationS <= 0) return false;
  const bitrate = (info.sizeBytes * 8) / info.durationS;
  return (
    Math.max(info.width, info.height) <= TARGET_LONG_EDGE &&
    bitrate <= PASSTHROUGH_MAX_BITRATE &&
    /mp4/i.test(info.type) &&
    info.sizeBytes <= MAX_VIDEO_BYTES
  );
}

/**
 * Whether this browser can do the 720p H.264 + AAC encode. Chrome/Edge/Safari
 * encode both natively; Firefox encodes H.264 but not AAC, so there the
 * official WASM AAC encoder (@mediabunny/aac-encoder) is registered on demand —
 * loaded only in that case, never in the main bundle.
 */
export async function canCompressInBrowser(): Promise<boolean> {
  if (typeof window === "undefined" || typeof window.VideoEncoder === "undefined") return false;
  try {
    const { canEncodeVideo, canEncodeAudio } = await import("mediabunny");
    const aacOptions = { numberOfChannels: 2, sampleRate: 48000, bitrate: TARGET_AUDIO_BITRATE };
    // Mediabunny test-encodes a frame on Firefox (its isConfigSupported over-promises).
    if (!(await canEncodeVideo("avc", { width: 1280, height: 720, bitrate: TARGET_VIDEO_BITRATE }))) return false;
    if (await canEncodeAudio("aac", aacOptions)) return true;
    const { registerAacEncoder } = await import("@mediabunny/aac-encoder");
    registerAacEncoder();
    return await canEncodeAudio("aac", aacOptions);
  } catch {
    return false;
  }
}

/** The output box for a 1280 long edge: set ONE side, the other keeps the aspect. */
function targetBox(info: VideoInfo): { width?: number; height?: number } {
  if (Math.max(info.width, info.height) <= TARGET_LONG_EDGE) return {};
  return info.width >= info.height ? { width: TARGET_LONG_EDGE } : { height: TARGET_LONG_EDGE };
}

/**
 * Cut + compress + poster. `onProgress` gets 0–1 while encoding. Throws
 * VideoNeedsAppError only on a browser that can't encode AND a file that can't
 * go up as it is.
 */
export async function prepareListingVideo(
  file: File,
  win?: VideoWindow,
  onProgress?: (fraction: number) => void
): Promise<PreparedVideo> {
  let info: VideoInfo;
  try {
    info = await getVideoInfo(file);
  } catch {
    if (!canUploadUnread(file)) throw new VideoNeedsAppError();
    return { blob: file, poster: null, durationS: 0, reencoded: false };
  }
  const window_ = win ?? defaultWindow(info.durationS);

  let blob: Blob;
  let reencoded = false;
  if (canPassThrough(info, window_)) {
    blob = file;
  } else if (await canCompressInBrowser()) {
    blob = await compress(file, info, window_, onProgress);
    reencoded = true;
  } else {
    // No encoder here: only a phone MP4/MOV that needs no cut and fits the cap
    // can go up as it is (the server takes mp4/mov only).
    const whole = window_.startS <= 0 && window_.endS >= info.durationS - 0.5;
    if (!whole || !canUploadUnread(file)) throw new VideoNeedsAppError();
    blob = file;
  }
  if (blob.size > MAX_VIDEO_BYTES) throw new VideoNeedsAppError();

  const durationS = Math.round((window_.endS - window_.startS) * 10) / 10;
  return { blob, poster: await grabPoster(blob, Math.min(1, durationS / 2)), durationS: durationS || 0, reencoded };
}

async function compress(file: File, info: VideoInfo, win: VideoWindow, onProgress?: (f: number) => void): Promise<Blob> {
  const { Input, ALL_FORMATS, BlobSource, Output, Mp4OutputFormat, BufferTarget, Conversion } = await import("mediabunny");
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
  const conversion = await Conversion.init({
    input,
    output,
    trim: { start: win.startS, end: win.endS },
    video: { ...targetBox(info), codec: "avc", bitrate: TARGET_VIDEO_BITRATE },
    audio: { codec: "aac", bitrate: TARGET_AUDIO_BITRATE },
    showWarnings: false,
  });
  if (!conversion.isValid) throw new VideoNeedsAppError();
  if (onProgress) conversion.onProgress = (p) => onProgress(Math.min(1, p));
  await conversion.execute();
  const buffer = output.target.buffer;
  if (!buffer) throw new Error("video_compress_failed");
  return new Blob([buffer], { type: "video/mp4" });
}

/** A JPEG frame at `atS` (≤ 720 wide); null if the browser can't draw it. */
export function grabPoster(video: Blob, atS: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(video);
    const v = document.createElement("video");
    v.muted = true;
    v.preload = "auto";
    v.playsInline = true;
    const done = (b: Blob | null) => {
      URL.revokeObjectURL(url);
      resolve(b);
    };
    v.onloadeddata = () => {
      v.currentTime = Math.max(0, atS);
    };
    v.onseeked = () => {
      const scale = Math.min(1, 720 / (v.videoWidth || 720));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round((v.videoWidth || 720) * scale);
      canvas.height = Math.round((v.videoHeight || 405) * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return done(null);
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => done(b), "image/jpeg", 0.8);
    };
    v.onerror = () => done(null);
    v.src = url;
  });
}
