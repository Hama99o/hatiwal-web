"use client";

import { useSyncExternalStore } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { uploadListingVideo } from "@/lib/api/me";
import { uploadShopVideo } from "@/lib/api/shops";
import { ApiError } from "@/lib/api/client";
import { prepareListingVideo, VideoNeedsAppError, type PreparedVideo, type VideoWindow } from "@/lib/listing-video";

/**
 * VID / SHOP-MEDIA — the web's background video upload, one job per target
 * (a listing's video or a shop's video). The listing is
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

/** What the video belongs to. */
export interface VideoTarget {
  kind: "listing" | "shop";
  id: number;
}

const keyOf = (t: VideoTarget) => `${t.kind}:${t.id}`;

export interface VideoUploadJob {
  target: VideoTarget;
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

const jobs = new Map<string, Internal>();
const listeners = new Set<() => void>();
const running = new Set<string>();
let snapshot: Record<string, VideoUploadJob> = {};

function emit() {
  snapshot = Object.fromEntries(
    [...jobs.entries()].map(([key, { target, phase, progress, error }]) => [key, { target, phase, progress, error }]),
  );
  listeners.forEach((l) => l());
}

function patch(key: string, changes: Partial<Internal>) {
  const job = jobs.get(key);
  if (!job) return;
  jobs.set(key, { ...job, ...changes });
  emit();
}

export function startVideoUpload(qc: QueryClient, target: VideoTarget, file: File, window?: VideoWindow): void {
  jobs.set(keyOf(target), { target, file, window, qc, phase: "preparing", progress: 0 });
  emit();
  void run(keyOf(target));
}

export function retryVideoUpload(target: VideoTarget): void {
  const key = keyOf(target);
  const job = jobs.get(key);
  if (!job || running.has(key)) return;
  patch(key, { phase: job.prepared ? "uploading" : "preparing", progress: 0, error: undefined });
  void run(key);
}

export function discardVideoUpload(target: VideoTarget): void {
  if (jobs.delete(keyOf(target))) emit();
}

// The listing names VID shipped with.
export const startListingVideoUpload = (qc: QueryClient, listingId: number, file: File, window?: VideoWindow) =>
  startVideoUpload(qc, { kind: "listing", id: listingId }, file, window);
export const retryListingVideoUpload = (listingId: number) => retryVideoUpload({ kind: "listing", id: listingId });
export const discardListingVideoUpload = (listingId: number) => discardVideoUpload({ kind: "listing", id: listingId });

/** Upload to the target's endpoint, then refresh the caches its pages read. */
async function uploadAndRefresh(job: Internal, prepared: PreparedVideo, onProgress: (p: number) => void) {
  const { qc, target } = job;
  if (target.kind === "listing") {
    const listing = await uploadListingVideo(target.id, prepared, onProgress);
    return () => {
      qc.setQueryData(["my-listing", String(target.id)], listing);
      void qc.invalidateQueries({ queryKey: ["my-listing", target.id] });
      void qc.invalidateQueries({ queryKey: ["my-listing", String(target.id)] });
      void qc.invalidateQueries({ queryKey: ["my-listings"] });
    };
  }
  const shop = await uploadShopVideo(target.id, prepared, onProgress);
  return () => {
    qc.setQueryData(["shop", target.id], shop);
    void qc.invalidateQueries({ queryKey: ["shop", target.id] });
  };
}

async function run(key: string) {
  if (running.has(key)) return;
  running.add(key);
  try {
    let job = jobs.get(key);
    if (!job) return;
    if (!job.prepared) {
      const prepared = await prepareListingVideo(job.file, job.window, (p) => patch(key, { progress: p }));
      if (!jobs.has(key)) return; // discarded meanwhile
      patch(key, { prepared, phase: "uploading", progress: 0 });
      job = jobs.get(key)!;
    }
    const refresh = await uploadAndRefresh(job, job.prepared!, (p) => patch(key, { progress: p }));
    const current = jobs.get(key);
    if (!current || current.file !== job.file) return; // replaced or discarded mid-upload
    jobs.delete(key);
    emit();
    refresh();
  } catch (e) {
    if (!jobs.has(key)) return;
    if (e instanceof VideoNeedsAppError) {
      patch(key, { phase: "needs_app", progress: 0 });
    } else if (e instanceof ApiError && (e.status === 403 || e.status === 404)) {
      jobs.delete(key); // sold, deleted, closed or not ours: nothing to retry
      emit();
    } else {
      patch(key, { phase: "failed", progress: 0, error: e instanceof ApiError ? `http_${e.status}` : "network" });
    }
  } finally {
    running.delete(key);
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const EMPTY: Record<string, VideoUploadJob> = {};

/** The pending upload for one target, or undefined. */
export function useVideoUpload(target: VideoTarget): VideoUploadJob | undefined {
  const all = useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);
  return all[keyOf(target)];
}

export const useListingVideoUpload = (listingId: number) => useVideoUpload({ kind: "listing", id: listingId });
