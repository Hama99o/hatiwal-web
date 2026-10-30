"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Mic, MicOff, Pause, SendHorizontal, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { VoicePlayer } from "@/components/chat/voice-player";
import { VoiceWaveform } from "@/components/chat/voice-waveform";
import { useVoiceRecorder, type VoiceRecording } from "@/lib/voice/use-voice-recorder";
import { voiceClock, VOICE_MAX_MS } from "@/lib/voice/clock";
import { cn } from "@/lib/utils";

/**
 * The composer row while a voice message is being made (hatiwal-mobile
 * docs/design/VOICE_MESSAGES.md §3, the WhatsApp "locked" row):
 *
 *   recording: 🗑 · ● 0:07 / 2:00 · live bars · ⏸ · ■ · ➤
 *   paused:    🗑 · ● 0:07 / 2:00 · frozen bars · 🎤 · ■ · ➤
 *   preview:   🗑 · ▶︎ waveform 0:42 1× · ➤
 *
 * It starts recording as soon as it opens (the 🎤 tap). `onSend` uploads; the
 * row stays (➤ spinning) until it resolves, and keeps the preview on failure.
 */
export function VoiceComposer({
  onSend,
  onClose,
}: {
  onSend: (recording: VoiceRecording) => Promise<boolean>;
  onClose: () => void;
}) {
  const t = useTranslations("chat.voice");
  const rec = useVoiceRecorder();
  const [sending, setSending] = useState(false);
  // ➤ during recording: stop, then send as soon as the preview exists.
  const sendWhenReady = useRef(false);

  useEffect(() => {
    rec.start();
    // Once, on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Whatever ended a recording, said once.
  useEffect(() => {
    if (!rec.notice) return;
    if (rec.notice === "tooShort") toast(t("tooShort"));
    else if (rec.notice === "maxReached") toast(t("maxReached"));
    else if (rec.notice === "interrupted") toast(t("interrupted"));
    rec.clearNotice();
    if (rec.notice === "tooShort") onClose();
  }, [rec, rec.notice, t, onClose]);

  const send = async (recording: VoiceRecording) => {
    if (sending) return;
    setSending(true);
    const ok = await onSend(recording);
    setSending(false);
    if (ok) {
      URL.revokeObjectURL(recording.url);
      onClose();
    }
  };

  useEffect(() => {
    if (rec.state === "preview" && rec.recording && sendWhenReady.current) {
      sendWhenReady.current = false;
      void send(rec.recording);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.state, rec.recording]);

  const cancel = () => {
    rec.discard();
    onClose();
  };

  if (rec.state === "denied" || rec.state === "noMicrophone" || rec.state === "unsupported" || rec.state === "failed") {
    const body =
      rec.state === "denied" ? t("permissionHowToWeb")
        : rec.state === "noMicrophone" ? t("noMicrophone")
          : rec.state === "unsupported" ? t("unsupported")
            : t("recordFailed");
    return (
      <div className="flex items-start gap-3 border-t p-3" role="alert" data-testid="voice-permission">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <MicOff className="size-5" />
        </span>
        <div className="min-w-0 flex-1 text-sm">
          {rec.state === "denied" && <p className="font-semibold">{t("permissionTitle")}</p>}
          <p className="text-muted-foreground">{rec.state === "denied" ? `${t("permissionDenied")} ${body}` : body}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {rec.state !== "unsupported" && (
            <Button type="button" size="sm" variant="outline" onClick={() => rec.start()}>
              {t("tryAgain")}
            </Button>
          )}
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            {t("discard")}
          </Button>
        </div>
      </div>
    );
  }

  const live = rec.state === "recording" || rec.state === "paused" || rec.state === "starting";
  const nearEnd = rec.elapsedMs >= VOICE_MAX_MS - 10_000;

  return (
    <div className="flex items-center gap-2 border-t p-3" data-testid="voice-composer" data-state={rec.state}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="shrink-0 text-destructive hover:text-destructive"
        aria-label={t("delete")}
        onClick={cancel}
        disabled={sending}
        data-testid="voice-delete"
      >
        <Trash2 className="size-5" />
      </Button>

      {live ? (
        <>
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-muted px-3 py-1.5">
            <span
              className={cn(
                "size-2.5 shrink-0 rounded-full",
                rec.state === "recording" ? "animate-pulse bg-destructive" : "bg-muted-foreground",
              )}
              aria-hidden
            />
            <span className="sr-only" aria-live="polite">
              {rec.state === "paused" ? t("paused") : t("recording")}
            </span>
            <span
              dir="ltr"
              className={cn("shrink-0 text-sm tabular-nums", nearEnd ? "font-semibold text-warning" : "text-foreground")}
              data-testid="voice-timer"
            >
              {voiceClock(rec.elapsedMs, "floor")} / {voiceClock(VOICE_MAX_MS)}
            </span>
            <VoiceWaveform levels={padLive(rec.liveLevels)} progress={1} className="h-6" />
          </div>
          {rec.state === "paused" ? (
            <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label={t("resume")} onClick={rec.resume} data-testid="voice-resume">
              <Mic className="size-5" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              aria-label={t("pause")}
              onClick={rec.pause}
              disabled={rec.state !== "recording"}
              data-testid="voice-pause"
            >
              <Pause className="size-5" />
            </Button>
          )}
          <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label={t("stop")} onClick={rec.stop} disabled={rec.state === "starting"} data-testid="voice-stop">
            <Square className="size-4" fill="currentColor" />
          </Button>
        </>
      ) : rec.state === "preview" && rec.recording ? (
        <div className="flex min-w-0 flex-1 items-center rounded-full bg-muted px-2 py-1">
          <VoicePlayer
            src={rec.recording.url}
            durationMs={rec.recording.durationMs}
            waveform={rec.recording.waveform}
            className="w-full"
          />
        </div>
      ) : (
        <div className="flex-1" />
      )}

      <Button
        type="button"
        size="icon"
        className="shrink-0"
        aria-label={t("send")}
        disabled={sending || rec.state === "starting"}
        onClick={() => {
          if (rec.state === "preview" && rec.recording) void send(rec.recording);
          else if (rec.state === "recording" || rec.state === "paused") {
            sendWhenReady.current = true;
            rec.stop();
          }
        }}
        data-testid="voice-send"
      >
        {sending ? <Loader2 className="size-4 animate-spin" aria-label={t("sending")} /> : <SendHorizontal className="size-4 rtl:-scale-x-100" />}
      </Button>
    </div>
  );
}

/** The live meter scrolls in from the end: pad the start while it fills. */
function padLive(levels: number[]): number[] {
  const bars = 40;
  return [...Array.from({ length: Math.max(0, bars - levels.length) }, () => 0), ...levels.slice(-bars)];
}
