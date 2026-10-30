"use client";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/utils";

/**
 * A voice message's bars (0–100). `progress` (0–1) fills the played part in
 * the strong colour; in ps/fa/ur the row follows the page direction, so it
 * fills right → left. With `onSeek` it is a slider: tap or drag to jump,
 * arrow keys step 5 %.
 */
export function VoiceWaveform({
  levels,
  progress = 0,
  onSeek,
  label,
  valueText,
  tone = "default",
  className,
}: {
  levels: number[];
  progress?: number;
  onSeek?: (fraction: number) => void;
  /** The slider's accessible name (required with onSeek). */
  label?: string;
  /** Spoken position, e.g. "0:05 / 0:12". */
  valueText?: string;
  /** "mine": on the primary-coloured bubble. */
  tone?: "default" | "mine";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const played = Math.round(Math.min(1, Math.max(0, progress)) * levels.length);

  const fractionAt = (clientX: number) => {
    const el = ref.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const rtl = getComputedStyle(el).direction === "rtl";
    const x = rtl ? rect.right - clientX : clientX - rect.left;
    return Math.min(1, Math.max(0, x / rect.width));
  };

  const onPointer = (e: PointerEvent<HTMLDivElement>) => {
    if (!onSeek) return;
    if (e.type === "pointerdown") e.currentTarget.setPointerCapture(e.pointerId);
    else if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    onSeek(fractionAt(e.clientX));
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onSeek) return;
    const step = { ArrowRight: 0.05, ArrowUp: 0.05, ArrowLeft: -0.05, ArrowDown: -0.05 }[e.key];
    if (e.key === "Home") onSeek(0);
    else if (e.key === "End") onSeek(1);
    else if (step !== undefined) {
      const rtl = ref.current ? getComputedStyle(ref.current).direction === "rtl" : false;
      const horizontal = e.key === "ArrowLeft" || e.key === "ArrowRight";
      onSeek(Math.min(1, Math.max(0, progress + (rtl && horizontal ? -step : step))));
    } else return;
    e.preventDefault();
  };

  return (
    <div
      ref={ref}
      className={cn("flex h-8 min-w-0 flex-1 items-center gap-[2px]", onSeek && "cursor-pointer touch-none", className)}
      onPointerDown={onPointer}
      onPointerMove={onPointer}
      onKeyDown={onKey}
      {...(onSeek
        ? {
            role: "slider",
            tabIndex: 0,
            "aria-label": label,
            "aria-valuemin": 0,
            "aria-valuemax": 100,
            "aria-valuenow": Math.round(progress * 100),
            "aria-valuetext": valueText,
          }
        : { "aria-hidden": true })}
      data-testid="voice-waveform"
    >
      {levels.map((level, i) => (
        <span
          key={i}
          className={cn(
            "w-[3px] shrink-0 rounded-full transition-colors",
            tone === "mine"
              ? i < played ? "bg-primary-foreground" : "bg-primary-foreground/40"
              : i < played ? "bg-primary" : "bg-muted-foreground/35",
          )}
          // A floor so silence still draws a dot, not nothing.
          style={{ height: `${Math.max(12, level)}%` }}
        />
      ))}
    </div>
  );
}
