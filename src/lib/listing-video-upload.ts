"use client";

import { useSyncExternalStore } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { uploadListingVideo } from "@/lib/api/me";
import { ApiError } from "@/lib/api/client";
import { prepareListingVideo, VideoNeedsAppError, type PreparedVideo, type VideoWindow } from "@/lib/listing-video";

/**
 * VID — the web's background video upload, one job per listing. The listing is
 * already saved and live when this starts (publishing never waits for it,
 * docs/LISTING_VIDEO.md rule 4); the job lives in this module so it carries on
 * across client-side navigation (form → My listing). A failure leaves a job the
 * seller retries from the listing (ListingVideoUploadStatus).
 *
 * Unlike the app, a tab that is closed or reloaded loses the job: a browser
 * cannot keep the picked file. The listing stays live with its photos; the
 * seller adds the video again from Edit.
 */
export type VideoUploadPhase = "preparing" | "uploading" | "failed" | "needs_app";

export interface VideoUploadJob {
  listingId: number;
  phase: VideoUploadPhase;
  /** 0–1 of the current phase (encode, then upload). */
  progress: number;
  error?: string;
}

interface Internal extends VideoUploadJob {
  file: File;
  window?: VideoWindow;
  prepared?: PreparedVideo;
  qc: QueryClient;
}

const jobs = new Map<number, Internal>();
const listeners = new Set<() => void>();
const running = new Set<number>();
let snapshot: Record<number, VideoUploadJob> = {};

function emit() {
  snapshot = Object.fromEntries(
    [...jobs.values()].map(({ listingId, phase, progress, error }) => [listingId, { listingId, phase, progress, error }]),
  );
  listeners.forEach((l) => l());
}

function patch(id: number, changes: Partial<Internal>) {
  const job = jobs.get(id);
  if (!job) return;
  jobs.set(id, { ...job, ...changes });
  emit();
}

export function startListingVideoUpload(qc: QueryClient, listingId: number, file: File, window?: VideoWindow): void {
  jobs.set(listingId, { listingId, file, window, qc, phase: "preparing", progress: 0 });
  emit();
  void run(listingId);
}

export function retryListingVideoUpload(listingId: number): void {
  const job = jobs.get(listingId);
  if (!job || running.has(listingId)) return;
  patch(listingId, { phase: job.prepared ? "uploading" : "preparing", progress: 0, error: undefined });
  void run(listingId);
}

export function discardListingVideoUpload(listingId: number): void {
  if (jobs.delete(listingId)) emit();
}

async function run(listingId: number) {
  if (running.has(listingId)) return;
  running.add(listingId);
  try {
    let job = jobs.get(listingId);
    if (!job) return;
    if (!job.prepared) {
      const prepared = await prepareListingVideo(job.file, job.window, (p) => patch(listingId, { progress: p }));
      if (!jobs.has(listingId)) return; // discarded meanwhile
      patch(listingId, { prepared, phase: "uploading", progress: 0 });
      job = jobs.get(listingId)!;
    }
    const prepared = job.prepared!;
    const listing = await uploadListingVideo(listingId, prepared, (p) => patch(listingId, { progress: p }));
    const current = jobs.get(listingId);
    if (!current || current.file !== job.file) return; // replaced or discarded mid-upload
    jobs.delete(listingId);
    emit();
    const qc = job.qc;
    qc.setQueryData(["my-listing", String(listingId)], listing);
    void qc.invalidateQueries({ queryKey: ["my-listing", listingId] });
    void qc.invalidateQueries({ queryKey: ["my-listing", String(listingId)] });
    void qc.invalidateQueries({ queryKey: ["my-listings"] });
  } catch (e) {
    if (!jobs.has(listingId)) return;
    if (e instanceof VideoNeedsAppError) {
      patch(listingId, { phase: "needs_app", progress: 0 });
    } else if (e instanceof ApiError && (e.status === 403 || e.status === 404)) {
      discardListingVideoUpload(listingId); // sold, deleted or not ours: nothing to retry
    } else {
      patch(listingId, { phase: "failed", progress: 0, error: e instanceof ApiError ? `http_${e.status}` : "network" });
    }
  } finally {
    running.delete(listingId);
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const EMPTY: Record<number, VideoUploadJob> = {};

/** The pending upload for one listing, or undefined. */
export function useListingVideoUpload(listingId: number): VideoUploadJob | undefined {
  const all = useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);
  return all[listingId];
}
