import type { AppState, SleepEntry } from "../types";

/*
 * Sleep tracking helpers. Entries store full timestamps (ms since epoch, so time-zone independent)
 * and are keyed by `date`: the local calendar date of the wake-up, fixed when saved. "Last night"
 * is the entry whose date is today. We only know when someone was in bed, so this is always called
 * "time in bed", never "sleep".
 */

/** Longest time in bed we accept; anything longer is almost certainly a typo. */
export const MAX_MINUTES = 20 * 60;
/** How long skipped check-ins are remembered. */
const KEEP_SKIPS = 60;

const pad = (n: number) => String(n).padStart(2, "0");

/** Local calendar date (YYYY-MM-DD) of a timestamp. */
export const localDate = (t: number): string => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Local clock time (HH:MM, 24h) of a timestamp, as an <input type="time"> expects. */
export const localTime = (t: number): string => {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** A date string shifted by whole days (calendar days, so DST doesn't matter). */
export const addDays = (date: string, days: number): string => {
  const [y, m, d] = date.split("-").map(Number);
  return localDate(new Date(y, m - 1, d + days, 12).getTime());
};

/** Local timestamp for a date and a HH:MM time; null when either is missing or malformed. */
export const combine = (date: string, time: string): number | null => {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const tm = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!dm || !tm) return null;
  const t = new Date(+dm[1], +dm[2] - 1, +dm[3], +tm[1], +tm[2]).getTime();
  return Number.isFinite(t) ? t : null;
};

/**
 * Turn the form (wake-up date, bedtime, wake-up time) into timestamps. The bedtime belongs to the
 * same date as the wake-up unless that would put it at or after the wake-up; then it was the
 * evening before (23:00 → 07:30 crosses midnight).
 */
export function nightFromInputs(wakeDate: string, bedTime: string, wakeTime: string): { bedAt: number; wakeAt: number } | null {
  const wakeAt = combine(wakeDate, wakeTime);
  let bedAt = combine(wakeDate, bedTime);
  if (wakeAt === null || bedAt === null) return null;
  if (bedAt >= wakeAt) bedAt = combine(addDays(wakeDate, -1), bedTime)!;
  return { bedAt, wakeAt };
}

/** Real elapsed minutes, so a night across a daylight-saving change is still correct. */
export const minutesBetween = (bedAt: number, wakeAt: number): number => Math.round((wakeAt - bedAt) / 60000);

/** Why a night can't be saved, or null when it's fine. */
export function validateNight(bedAt: number | null | undefined, wakeAt: number | null | undefined, now = Date.now()): string | null {
  if (bedAt == null || wakeAt == null || !Number.isFinite(bedAt) || !Number.isFinite(wakeAt)) return "Enter both a bedtime and a wake-up time.";
  if (wakeAt <= bedAt) return "Wake-up must be after bedtime.";
  if (minutesBetween(bedAt, wakeAt) > MAX_MINUTES) return "That's more than 20 hours in bed. Check the times.";
  // A few minutes of slack for clocks that differ between devices.
  if (wakeAt > now + 5 * 60000) return "Wake-up can't be in the future.";
  return null;
}

/** "8h 30m", "45m", "9h". */
export const formatDuration = (minutes: number): string => {
  const m = Math.round(minutes);
  const h = Math.floor(m / 60), r = m % 60;
  if (h === 0) return `${r}m`;
  return r === 0 ? `${h}h` : `${h}h ${r}m`;
};

/** Clock time in the device's current time zone and locale. */
export const formatClock = (t: number): string => new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

/** The entry for a night (by wake-up date), skipping `exceptId` (the entry being edited). */
export const entryForDate = (entries: SleepEntry[], date: string, exceptId?: string): SleepEntry | undefined =>
  entries.find((e) => e.date === date && e.id !== exceptId);

/** Entries by wake-up date, for quick lookups (e.g. matching a workout to the night before). */
export const sleepByDate = (entries: SleepEntry[]): Map<string, SleepEntry> => new Map(entries.map((e) => [e.date, e]));

/** Newest night first. */
export const sortSleep = (entries: SleepEntry[]): SleepEntry[] => [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.wakeAt - a.wakeAt);

/** Average minutes in bed over the last `days` nights up to and including `today`; null without data. */
export function averageMinutes(entries: SleepEntry[], days: number, today: string): number | null {
  const from = addDays(today, -(days - 1));
  const inRange = entries.filter((e) => e.date >= from && e.date <= today);
  if (!inRange.length) return null;
  return Math.round(inRange.reduce((sum, e) => sum + e.minutes, 0) / inRange.length);
}

/** The last `n` nights ending today, oldest first, with null for nights without an entry. */
export function lastNights(entries: SleepEntry[], n: number, today: string): { date: string; minutes: number | null }[] {
  const byDate = sleepByDate(entries);
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, i - (n - 1));
    return { date, minutes: byDate.get(date)?.minutes ?? null };
  });
}

/**
 * One entry per night. Two devices can each log the same night before syncing; the most recently
 * updated one wins (ties: highest id), so every device keeps the same one.
 */
export function dedupeByNight(entries: SleepEntry[]): SleepEntry[] {
  const best = new Map<string, SleepEntry>();
  for (const e of entries) {
    const cur = best.get(e.date);
    if (!cur || e.updatedAt > cur.updatedAt || (e.updatedAt === cur.updatedAt && e.id > cur.id)) best.set(e.date, e);
  }
  return sortSleep([...best.values()]);
}

/** Add a skipped night, keeping only recent ones. */
export const addSkip = (skips: string[], date: string): string[] =>
  [...new Set([...skips, date])].sort().slice(-KEEP_SKIPS);

/**
 * Show the morning check-in on Home? Only with tracking on, in the morning (04:00–14:00), and only
 * while last night is neither logged nor skipped.
 */
export function shouldShowCheckIn(state: Pick<AppState, "settings" | "sleep" | "sleepSkips">, now = Date.now()): boolean {
  if (!state.settings.sleepTracking) return false;
  const hour = new Date(now).getHours();
  if (hour < 4 || hour >= 14) return false;
  const today = localDate(now);
  return !entryForDate(state.sleep, today) && !state.sleepSkips.includes(today);
}
