let ctx: AudioContext | null = null;

/** Create or resume the audio context. Call from a tap (e.g. ticking a set) so iOS lets the rest-end beep play later. */
export const unlockAudio = (): void => {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    /* audio unavailable */
  }
};

/** Short beep via WebAudio. */
export const beep = (freq = 880, ms = 180, volume = 0.2): void => {
  try {
    unlockAudio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000);
    osc.stop(ctx.currentTime + ms / 1000);
  } catch {
    /* audio unavailable */
  }
};

/** Vibrate where supported (not on iPhone). */
export const vibrate = (pattern: number | number[]): void => {
  if ("vibrate" in navigator) navigator.vibrate?.(pattern);
};

export const formatClock = (totalSeconds: number): string => {
  const s = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
