/**
 * Only one voice message plays at a time, anywhere in the app: starting one
 * pauses whichever was playing (and starting to record pauses it too).
 */
let current: HTMLAudioElement | null = null;

export function claimPlayback(audio: HTMLAudioElement): void {
  if (current && current !== audio) current.pause();
  current = audio;
}

export function stopAnyPlayback(): void {
  current?.pause();
}
