import type { ManualPR, Workout, WorkoutExercise } from "../types";

/** Epley estimated one-rep max. */
export const estimate1RM = (weight: number, reps: number): number =>
  reps <= 0 ? 0 : reps === 1 ? weight : weight * (1 + reps / 30);

const doneSets = (we: WorkoutExercise) => we.sets.filter((s) => s.done);

export const workoutVolume = (w: Workout): number =>
  w.exercises.reduce(
    (sum, we) => sum + doneSets(we).reduce((s, set) => s + set.reps * set.weight, 0),
    0
  );

export const completedSetCount = (w: Workout): number =>
  w.exercises.reduce((n, we) => n + doneSets(we).length, 0);

export const durationMinutes = (w: Workout): number =>
  w.finishedAt ? Math.max(1, Math.round((w.finishedAt - w.startedAt) / 60000)) : 0;

export interface ExercisePoint {
  date: number;
  best1RM: number;
  topWeight: number;
  volume: number;
}

/** One point per workout that contains the exercise, oldest first. */
export const exerciseHistory = (workouts: Workout[], exerciseId: string): ExercisePoint[] =>
  workouts
    .flatMap((w) => {
      const sets = w.exercises
        .filter((we) => we.exerciseId === exerciseId)
        .flatMap(doneSets);
      if (sets.length === 0) return [];
      return [
        {
          date: w.startedAt,
          best1RM: Math.round(Math.max(...sets.map((s) => estimate1RM(s.weight, s.reps))) * 10) / 10,
          topWeight: Math.max(...sets.map((s) => s.weight)),
          volume: sets.reduce((v, s) => v + s.weight * s.reps, 0),
        },
      ];
    })
    .sort((a, b) => a.date - b.date);

export interface PersonalRecord {
  exerciseId: string;
  weight: number;
  reps: number;
  est1RM: number;
  date: number;
  manual?: boolean;
}

/** Best set (by estimated 1RM) per exercise, from logged workouts and hand-entered PRs. */
export const personalRecords = (workouts: Workout[], manual: ManualPR[] = []): PersonalRecord[] => {
  const best = new Map<string, PersonalRecord>();
  const consider = (exerciseId: string, weight: number, reps: number, date: number, isManual: boolean) => {
    const est = estimate1RM(weight, reps);
    const cur = best.get(exerciseId);
    if (!cur || est > cur.est1RM) {
      best.set(exerciseId, { exerciseId, weight, reps, est1RM: Math.round(est * 10) / 10, date, ...(isManual && { manual: true }) });
    }
  };
  for (const w of workouts)
    for (const we of w.exercises) for (const s of doneSets(we)) consider(we.exerciseId, s.weight, s.reps, w.startedAt, false);
  for (const m of manual) consider(m.exerciseId, m.weight, m.reps, m.date, true);
  return [...best.values()].sort((a, b) => b.est1RM - a.est1RM);
};

/** Best estimated 1RM for one exercise across history, hand-entered PRs and extra sets (e.g. the active workout). */
export const bestEst1RM = (
  workouts: Workout[],
  manual: ManualPR[],
  exerciseId: string,
  extraSets: { weight: number; reps: number }[] = []
): number => {
  let best = 0;
  for (const w of workouts)
    for (const we of w.exercises)
      if (we.exerciseId === exerciseId) for (const s of doneSets(we)) best = Math.max(best, estimate1RM(s.weight, s.reps));
  for (const m of manual) if (m.exerciseId === exerciseId) best = Math.max(best, estimate1RM(m.weight, m.reps));
  for (const s of extraSets) best = Math.max(best, estimate1RM(s.weight, s.reps));
  return best;
};

const startOfWeek = (t: number): number => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return d.getTime();
};

/** Workouts and volume per week for the last `weeks` weeks, oldest first. */
export const weeklySummary = (workouts: Workout[], weeks: number, now = Date.now()) => {
  const thisWeek = startOfWeek(now);
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const d = new Date(thisWeek);
    d.setDate(d.getDate() - 7 * (weeks - 1 - i));
    return { week: d.getTime(), workouts: 0, volume: 0 };
  });
  for (const w of workouts) {
    const b = buckets.find((x) => x.week === startOfWeek(w.startedAt));
    if (b) {
      b.workouts += 1;
      b.volume += workoutVolume(w);
    }
  }
  return buckets;
};

/** Consecutive weeks (ending this week or last week) with at least one workout. */
export const weekStreak = (workouts: Workout[], now = Date.now()): number => {
  const weeks = new Set(workouts.map((w) => startOfWeek(w.startedAt)));
  const d = new Date(startOfWeek(now));
  if (!weeks.has(d.getTime())) d.setDate(d.getDate() - 7);
  let streak = 0;
  while (weeks.has(d.getTime())) {
    streak += 1;
    d.setDate(d.getDate() - 7);
  }
  return streak;
};

export const formatKg = (n: number): string =>
  n >= 10000 ? `${(n / 1000).toFixed(1)}t` : n >= 1000 ? `${Math.round(n).toLocaleString()} kg` : `${Math.round(n * 10) / 10} kg`;

/** Local-date key, YYYY-MM-DD. */
export const dayKey = (t: number | Date): string => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export interface DayActivity {
  workouts: number;
  volume: number;
  names: string[];
}

/** Workouts and volume per local calendar day. */
export const dailyActivity = (workouts: Workout[]): Map<string, DayActivity> => {
  const map = new Map<string, DayActivity>();
  for (const w of workouts) {
    const k = dayKey(w.startedAt);
    const cur = map.get(k) ?? { workouts: 0, volume: 0, names: [] };
    cur.workouts += 1;
    cur.volume += workoutVolume(w);
    cur.names.push(w.name);
    map.set(k, cur);
  }
  return map;
};

/** Intensity 0–4 for a day's volume, relative to the busiest day in the data. */
export const intensityLevel = (volume: number, maxVolume: number, trained: boolean): number => {
  if (!trained) return 0;
  if (maxVolume <= 0) return 2;
  return Math.min(4, Math.max(1, Math.ceil((volume / maxVolume) * 4)));
};

export interface WeekTotals {
  workouts: number;
  sets: number;
  volume: number;
  minutes: number;
}

export interface WeekPR {
  exerciseId: string;
  weight: number;
  reps: number;
  est1RM: number;
  /** Best estimated 1RM before this week's PR. */
  previous: number;
  date: number;
}

export interface WeekReport {
  thisWeek: WeekTotals;
  /** Last week up to the same weekday and time, so a partial week compares fairly. */
  lastWeek: WeekTotals;
  /** Best new PR per exercise set this week (first-ever attempts at a lift don't count). */
  newPRs: WeekPR[];
}

const totals = (ws: Workout[]): WeekTotals => ({
  workouts: ws.length,
  sets: ws.reduce((n, w) => n + completedSetCount(w), 0),
  volume: ws.reduce((v, w) => v + workoutVolume(w), 0),
  minutes: ws.reduce((m, w) => m + durationMinutes(w), 0),
});

/** This week (Monday to now) against the same stretch of last week, plus the PRs set this week. */
export function weekReport(workouts: Workout[], manual: ManualPR[], now = Date.now()): WeekReport {
  const thisStart = startOfWeek(now);
  const lastStart = new Date(thisStart);
  lastStart.setDate(lastStart.getDate() - 7);
  const inRange = (t: number, a: number, b: number) => t >= a && t < b;

  const thisWeek = workouts.filter((w) => inRange(w.startedAt, thisStart, now + 1));
  const sameTimeLastWeek = new Date(now);
  sameTimeLastWeek.setDate(sameTimeLastWeek.getDate() - 7);
  const lastWeek = workouts.filter((w) => inRange(w.startedAt, lastStart.getTime(), sameTimeLastWeek.getTime() + 1));

  // Best estimated 1RM per exercise from everything before this week.
  const best = new Map<string, number>();
  const bump = (id: string, est: number) => best.set(id, Math.max(best.get(id) ?? 0, est));
  for (const w of workouts)
    if (w.startedAt < thisStart) for (const we of w.exercises) for (const s of we.sets) if (s.done) bump(we.exerciseId, estimate1RM(s.weight, s.reps));
  for (const m of manual) if (m.date < thisStart) bump(m.exerciseId, estimate1RM(m.weight, m.reps));

  // Walk this week's sets in order; a set is a PR if it beats everything before it.
  const prs = new Map<string, WeekPR>();
  for (const w of [...thisWeek].sort((a, b) => a.startedAt - b.startedAt)) {
    for (const we of w.exercises) {
      for (const s of we.sets) {
        if (!s.done) continue;
        const est = estimate1RM(s.weight, s.reps);
        const prev = best.get(we.exerciseId) ?? 0;
        if (prev > 0 && est > prev) {
          const first = prs.get(we.exerciseId);
          prs.set(we.exerciseId, {
            exerciseId: we.exerciseId, weight: s.weight, reps: s.reps,
            est1RM: Math.round(est * 10) / 10,
            previous: first?.previous ?? Math.round(prev * 10) / 10,
            date: w.startedAt,
          });
        }
        if (prev > 0 || est > 0) best.set(we.exerciseId, Math.max(prev, est));
      }
    }
  }
  return { thisWeek: totals(thisWeek), lastWeek: totals(lastWeek), newPRs: [...prs.values()].sort((a, b) => b.date - a.date) };
}
