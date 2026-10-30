"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { stopAnyPlayback } from "@/lib/voice/player";
import { resampleLevels, VOICE_MAX_MS, VOICE_MIN_MS } from "@/lib/voice/clock";

/**
 * Recording a voice message in the browser (1.2.1, hatiwal-mobile
 * docs/design/VOICE_MESSAGES.md §6): MediaRecorder with native pause/resume,
 * a live level meter from a Web Audio analyser, a 2-minute cap.
 *
 * idle → recording ⇄ paused → preview (blob + 64-bar waveform) | discarded
 * Failures: denied (permission), noMicrophone, unsupported, failed.
 */
export type RecorderState =
  | "idle"
  | "starting"
  | "recording"
  | "paused"
  | "preview"
  | "denied"
  | "noMicrophone"
  | "unsupported"
  | "failed";

/** What ended a recording, for the toast the composer shows. */
export type RecorderNotice = "maxReached" | "tooShort" | "interrupted" | null;

export interface VoiceRecording {
  blob: Blob;
  url: string;
  durationMs: number;
  waveform: number[];
}

/** The live meter shows this many recent levels (≈ 10 per second). */
const LIVE_BARS = 40;
const LEVEL_EVERY_MS = 100;

/** The format this browser records best: m4a where it can (Safari), else Opus. */
export function pickVoiceMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const preferred = ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm"];
  return preferred.find((t) => MediaRecorder.isTypeSupported(t));
}

export function useVoiceRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [notice, setNotice] = useState<RecorderNotice>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [liveLevels, setLiveLevels] = useState<number[]>([]);
  const [recording, setRecording] = useState<VoiceRecording | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const levelsRef = useRef<number[]>([]);
  // Elapsed time = what was banked before the last pause + the running stretch.
  const bankedRef = useRef(0);
  const runningSinceRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const discardRef = useRef(false);
  const stateRef = useRef<RecorderState>("idle");
  stateRef.current = state;

  const elapsedNow = () =>
    bankedRef.current + (runningSinceRef.current == null ? 0 : performance.now() - runningSinceRef.current);

  const stopTicking = () => {
    if (tickRef.current != null) window.clearInterval(tickRef.current);
    tickRef.current = null;
  };

  const release = useCallback(() => {
    stopTicking();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }, []);

  const stop = useCallback((why: RecorderNotice = null) => {
    const rec = recorderRef.current;
    if (!rec || rec.state === "inactive") return;
    bankedRef.current = elapsedNow();
    runningSinceRef.current = null;
    if (why) setNotice(why);
    rec.stop(); // → onstop builds the preview (or drops a discard / a too-short clip)
  }, []);

  const startTicking = useCallback((analyser: AnalyserNode) => {
    const samples = new Uint8Array(analyser.fftSize);
    stopTicking();
    tickRef.current = window.setInterval(() => {
      const ms = elapsedNow();
      setElapsedMs(ms);
      if (ms >= VOICE_MAX_MS) {
        stop("maxReached");
        return;
      }
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const v of samples) sum += ((v - 128) / 128) ** 2;
      // RMS of speech sits well under 0.5: scale so normal talking fills the bar.
      const level = Math.min(100, Math.round(Math.sqrt(sum / samples.length) * 300));
      levelsRef.current.push(level);
      setLiveLevels((prev) => [...prev, level].slice(-LIVE_BARS));
    }, LEVEL_EVERY_MS);
  }, [stop]);

  const start = useCallback(async () => {
    const mimeType = pickVoiceMimeType();
    if (!navigator.mediaDevices?.getUserMedia || mimeType === undefined) {
      setState("unsupported");
      return;
    }
    setState("starting");
    setNotice(null);
    stopAnyPlayback();
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (error) {
      const name = (error as DOMException)?.name;
      setState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" ? "noMicrophone" : "failed");
      return;
    }
    streamRef.current = stream;
    chunksRef.current = [];
    levelsRef.current = [];
    bankedRef.current = 0;
    discardRef.current = false;
    setLiveLevels([]);
    setElapsedMs(0);

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);

    const rec = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 48_000 });
    recorderRef.current = rec;
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      release();
      const durationMs = bankedRef.current;
      if (discardRef.current) {
        setState("idle");
        return;
      }
      if (durationMs < VOICE_MIN_MS) {
        setNotice("tooShort");
        setState("idle");
        return;
      }
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || mimeType });
      setRecording({ blob, url: URL.createObjectURL(blob), durationMs, waveform: resampleLevels(levelsRef.current) });
      setState("preview");
    };
    // A track that ends by itself (the mic unplugged, the OS taking it away).
    stream.getAudioTracks().forEach((track) => {
      track.onended = () => stop("interrupted");
    });
    rec.start(250);
    runningSinceRef.current = performance.now();
    startTicking(analyser);
    setState("recording");
  }, [release, startTicking, stop]);

  const pause = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec || rec.state !== "recording") return;
    rec.pause();
    bankedRef.current = elapsedNow();
    runningSinceRef.current = null;
    stopTicking();
    setElapsedMs(bankedRef.current);
    setState("paused");
  }, []);

  const resume = useCallback(() => {
    const rec = recorderRef.current;
    const ctx = audioCtxRef.current;
    if (!rec || rec.state !== "paused" || !ctx || !streamRef.current) return;
    stopAnyPlayback();
    rec.resume();
    runningSinceRef.current = performance.now();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(streamRef.current).connect(analyser);
    startTicking(analyser);
    setState("recording");
  }, [startTicking]);

  /** Drop everything: a recording in progress or the preview. */
  const discard = useCallback(() => {
    discardRef.current = true;
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    else release();
    setRecording((old) => {
      if (old) URL.revokeObjectURL(old.url);
      return null;
    });
    setElapsedMs(0);
    setLiveLevels([]);
    setState("idle");
  }, [release]);

  // Hidden tab mid-recording: pause, keep what was said (no background recording).
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && stateRef.current === "recording") {
        pause();
        setNotice("interrupted");
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [pause]);

  // Leaving with a recording in progress or unsent: the browser asks first.
  useEffect(() => {
    if (state !== "recording" && state !== "paused" && state !== "preview") return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [state]);

  // Unmount: never leave the microphone on.
  useEffect(
    () => () => {
      discardRef.current = true;
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") rec.stop();
      release();
    },
    [release],
  );

  return {
    state,
    notice,
    clearNotice: () => setNotice(null),
    elapsedMs,
    liveLevels,
    recording,
    start,
    pause,
    resume,
    stop: () => stop(null),
    discard,
  };
}
