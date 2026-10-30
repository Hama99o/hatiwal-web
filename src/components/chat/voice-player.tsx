"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { VoiceWaveform } from "@/components/chat/voice-waveform";
import { claimPlayback } from "@/lib/voice/player";
import { voiceClock } from "@/lib/voice/clock";
import { cn } from "@/lib/utils";

const SPEEDS = [1, 1.5, 2] as const;

/**
 * Plays one voice message: ▶︎/⏸, the seekable waveform, the time (counting down
 * while it plays) and a 1× / 1.5× / 2× chip. The audio is NOT fetched until
 * the first ▶︎ (a thread full of voice messages costs nothing on 2G); the
 * waveform and duration come with the message. One plays at a time.
 */
export function VoicePlayer({
  src,
  durationMs,
  waveform,
  tone = "default",
  className,
}: {
  src: string;
  durationMs: number;
  waveform: number[];
  tone?: "default" | "mine";
  className?: string;
}) {
  const t = useTranslations("chat.voice");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [started, setStarted] = useState(false);

  // A new source (the preview re-recorded) starts from scratch.
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [src]);

  const audio = () => {
    if (audioRef.current) return audioRef.current;
    const a = new Audio();
    a.preload = "auto";
    a.src = src;
    a.playbackRate = speed;
    a.ontimeupdate = () => setPositionMs(a.currentTime * 1000);
    a.onplaying = () => {
      setLoading(false);
      setPlaying(true);
    };
    a.onpause = () => setPlaying(false);
    a.onended = () => {
      setPlaying(false);
      setPositionMs(0);
      a.currentTime = 0;
    };
    a.onerror = () => {
      setLoading(false);
      setPlaying(false);
      audioRef.current = null;
      toast.error(t("playFailed"));
    };
    audioRef.current = a;
    return a;
  };

  const toggle = () => {
    const a = audio();
    if (!a.paused) {
      a.pause();
      return;
    }
    claimPlayback(a);
    setStarted(true);
    if (a.readyState < 3) setLoading(true);
    a.play().catch(() => setLoading(false));
  };

  const seek = (fraction: number) => {
    const a = audio();
    const ms = fraction * durationMs;
    setPositionMs(ms);
    setStarted(true);
    a.currentTime = ms / 1000;
  };

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const progress = durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;
  const shownMs = playing ? Math.max(0, durationMs - positionMs) : started ? positionMs || durationMs : durationMs;
  const mine = tone === "mine";

  return (
    <div
      className={cn("flex w-64 max-w-full items-center gap-2", className)}
      role="group"
      aria-label={t("label", { duration: voiceClock(durationMs) })}
      data-testid="voice-player"
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? t("pausePlayback") : t("play")}
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          mine ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground",
        )}
        data-testid="voice-play"
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" aria-label={t("loading")} />
        ) : playing ? (
          <Pause className="size-4" fill="currentColor" />
        ) : (
          <Play className="size-4 translate-x-[1px] rtl:-scale-x-100" fill="currentColor" />
        )}
      </button>
      <VoiceWaveform
        levels={waveform}
        progress={progress}
        onSeek={seek}
        label={t("seek")}
        valueText={`${voiceClock(positionMs)} / ${voiceClock(durationMs)}`}
        tone={tone}
      />
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span
          dir="ltr"
          className={cn("text-xs tabular-nums", mine ? "text-primary-foreground/80" : "text-muted-foreground")}
          data-testid="voice-time"
        >
          {voiceClock(shownMs)}
        </span>
        {started && (
          <button
            type="button"
            onClick={cycleSpeed}
            aria-label={t("speed", { speed: `${speed}×` })}
            className={cn(
              "rounded-full px-1.5 text-[11px] leading-4 font-semibold tabular-nums",
              mine ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-foreground",
            )}
            dir="ltr"
            data-testid="voice-speed"
          >
            {speed}×
          </button>
        )}
      </div>
    </div>
  );
}
