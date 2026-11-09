let ctx: AudioContext | null = null;

/** Short beep via WebAudio; call once from a user gesture first to unlock audio on iOS. */
export const beep = (freq = 880, ms = 180, volume = 0.2): void => {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
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
  if ("vibrate" in navigator) navigator.vibrate?.(150);
};

export const formatClock = (totalSeconds: number): string => {
  const s = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
