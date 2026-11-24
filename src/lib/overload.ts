import type { AdviceStatus, AppState, Exercise, OverloadAdvice, ProgressionSettings, Workout } from "../types";

/*
 * Progressive overload by double progression:
 *  1. Keep the weight and add reps until every working set reaches the top of the rep range.
 *  2. Then add the exercise's increment and start again at the bottom of the range.
 *
 * The latest session decides the step; the two before it only add context (stagnation, decline).
 */

export const DEFAULT_MIN_REPS = 6;
export const DEFAULT_MAX_REPS = 10;

/** Starting increments; the user can change them per exercise. */
const DEFAULT_INCREMENTS: Record<string, number> = {
  deadlift: 5, "leg-press": 5, rdl: 2.5, squat: 2.5, bench: 2.5, ohp: 2.5, row: 2.5,
  "incline-db": 2, curl: 1, "lateral-raise": 1, "tricep-pushdown": 2.5,
  "t-bar-row": 2.5, "leg-extension": 2.5, "leg-curl": 2.5, sldl: 2.5, "plate-shoulder-press": 2.5,
  "cable-lateral-raise": 1, "cable-rear-delt-fly": 1, "one-arm-tricep-ext": 1, "db-preacher-curl": 1,
};
/** Exercises where reps are seconds, so weight progression makes no sense. */
const NO_PROGRESSION = new Set(["plank"]);

export const defaultProgression = (exerciseId: string, exercise?: Exercise): ProgressionSettings => ({
  exerciseId,
  minReps: DEFAULT_MIN_REPS,
  maxReps: DEFAULT_MAX_REPS,
  increment: DEFAULT_INCREMENTS[exerciseId] ?? (exercise?.muscle === "Biceps" || exercise?.muscle === "Triceps" ? 1 : 2.5),
  enabled: !NO_PROGRESSION.has(exerciseId),
  updatedAt: 0,
});

export const getProgression = (state: Pick<AppState, "progression" | "exercises">, exerciseId: string): ProgressionSettings =>
  state.progression.find((p) => p.exerciseId === exerciseId) ??
  defaultProgression(exerciseId, state.exercises.find((e) => e.id === exerciseId));

/** One past performance of an exercise: its working sets (the sets at the top weight; lighter sets count as warm-ups). */
export interface Session {
  workoutId: string;
  routineId?: string;
  date: number;
  weight: number;
  reps: number[];
}

/** The latest `count` valid sessions of an exercise, newest first. */
export function recentSessions(workouts: Workout[], exerciseId: string, count = 3): Session[] {
  const out: Session[] = [];
  for (const w of [...workouts].sort((a, b) => b.startedAt - a.startedAt)) {
    const sets = w.exercises
      .filter((we) => we.exerciseId === exerciseId)
      .flatMap((we) => we.sets)
      .filter((s) => s.done && s.reps > 0);
    if (sets.length === 0) continue;
    const weight = Math.max(...sets.map((s) => s.weight));
    out.push({
      workoutId: w.id,
      routineId: w.routineId,
      date: w.startedAt,
      weight,
      reps: sets.filter((s) => s.weight === weight).map((s) => s.reps),
    });
    if (out.length === count) break;
  }
  return out;
}

type Trend = "up" | "flat" | "down" | "reset";

/** How `newer` compares to `older`. Different set counts are compared over the sets both have. */
const trend = (newer: Session, older: Session): Trend => {
  if (newer.weight > older.weight) return "up";
  if (newer.weight < older.weight) return "reset";
  const k = Math.min(newer.reps.length, older.reps.length);
  const diff = sum(newer.reps.slice(0, k)) - sum(older.reps.slice(0, k));
  return diff > 0 ? "up" : diff < 0 ? "down" : "flat";
};

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);
const round2 = (n: number) => Math.round(n * 100) / 100;
const repsText = (reps: number[]) => reps.join(" / ");
const kg = (n: number) => `${round2(n)} kg`;

/** Lower the weight by about 10%, rounded down to a step the equipment allows. */
const deload = (weight: number, step: number): number => {
  const s = step > 0 ? step : 0.5;
  let next = Math.floor((weight * 0.9) / s + 1e-9) * s;
  if (next >= weight) next = weight - s;
  return Math.max(0, round2(next));
};

/** Pad or trim targets to the number of sets planned. */
const fit = (targets: number[], count: number): number[] =>
  Array.from({ length: Math.max(1, count) }, (_, i) => targets[i] ?? targets[targets.length - 1]);

export type AdviceResult = Omit<OverloadAdvice, "updatedAt">;

/**
 * The decision itself. `sessions` is newest first (at most 3 are used); `plannedSets` is the
 * routine's set count for this exercise, if the latest session came from a routine.
 */
export function analyze(sessions: Session[], settings: ProgressionSettings, plannedSets?: number): AdviceResult | null {
  const [last, prev, before] = sessions;
  if (!last || !settings.enabled) return null;

  const { minReps, maxReps, increment } = settings;
  const n = last.reps.length;
  const setCount = Math.max(n, plannedSets ?? 0);
  const w = last.weight;
  const t1 = prev ? trend(last, prev) : undefined;
  const t2 = prev && before ? trend(prev, before) : undefined;
  const sameWeight3 = !!before && last.weight === prev.weight && prev.weight === before.weight;
  const belowMin = (s: Session) => avg(s.reps) < minReps;
  const plusOne = last.reps.map((r) => Math.min(maxReps, Math.max(minReps, r + 1)));

  const base = { exerciseId: "", basedOnWorkoutId: last.workoutId, lastWeight: w, lastReps: last.reps, lastDate: last.date };
  const result = (status: AdviceStatus, recommendedWeight: number, targetReps: number[], reasons: string[]): AdviceResult => ({
    ...base, status, recommendedWeight: round2(recommendedWeight), targetReps: fit(targetReps, setCount), reasons,
  });

  const restTips = "Check your rest between sets (2–3 min on heavy sets), your technique and range of motion, and your sleep and food.";

  // A: every working set at the top of the range → add weight, restart at the bottom.
  if (last.reps.every((r) => r >= maxReps)) {
    if (plannedSets && n < plannedSets) {
      return result("hold", w, [maxReps], [
        `${n === 1 ? "Your set" : `All ${n} sets`} reached ${maxReps} reps, but ${plannedSets} were planned.`,
        `Do all ${plannedSets} sets at ${kg(w)} first, then the weight goes up.`,
      ]);
    }
    return result("increase", w + increment, [minReps], [
      `${n === 1 ? "Your working set" : `All ${n} working sets`} reached ${maxReps} reps (${repsText(last.reps)}) at ${kg(w)}, the top of your ${minReps}–${maxReps} range.`,
      w === 0
        ? `Add ${kg(increment)} (belt or vest) or move to a harder variation, and start again at ${minReps} reps.`
        : `Add ${kg(increment)} and start again at the bottom of the range: ${minReps}+ reps per set.`,
    ]);
  }

  // D: reps dropped two sessions in a row at the same weight.
  if (sameWeight3 && t1 === "down" && t2 === "down") {
    const drop = `Reps dropped two sessions in a row at ${kg(w)}: ${repsText(before.reps)} → ${repsText(prev.reps)} → ${repsText(last.reps)}.`;
    if (belowMin(last) && belowMin(prev) && w > 0) {
      return result("decrease", deload(w, increment), [minReps], [
        drop,
        `The last two sessions were below your minimum of ${minReps} reps. Lower the weight a little and build back up.`,
        restTips,
      ]);
    }
    return result("decline", w, prev.reps.map((r) => Math.min(maxReps, r)), [
      drop,
      `Keep ${kg(w)} for now and aim to get back to ${repsText(prev.reps)}. ${restTips}`,
    ]);
  }

  // C: three sessions at the same weight without more reps.
  if (sameWeight3 && t1 !== "up" && t2 !== "up") {
    const stuck = `Three sessions at ${kg(w)} without more reps: ${repsText(before.reps)} → ${repsText(prev.reps)} → ${repsText(last.reps)}.`;
    if (belowMin(last) && belowMin(prev) && belowMin(before) && w > 0) {
      return result("decrease", deload(w, increment), [minReps], [
        stuck,
        `All three were below your minimum of ${minReps} reps. Lower the weight a little and build back up.`,
      ]);
    }
    return result("stagnation", w, plusOne, [
      stuck,
      `Try ${kg(w)} again and go for one more rep on a set. ${restTips}`,
    ]);
  }

  // One worse session: keep the plan, don't react to a single off day.
  if (t1 === "down") {
    return result("hold", w, last.reps.map((r, i) => Math.min(maxReps, Math.max(r, prev.reps[i] ?? r))), [
      `Fewer reps than last time (${repsText(prev.reps)} → ${repsText(last.reps)}).`,
      `One off day doesn't change the plan: keep ${kg(w)} and aim to match last time.`,
    ]);
  }

  // Below the bottom of the range.
  if (last.reps.some((r) => r < minReps)) {
    return result("hold", w, plusOne, [
      `Some sets were below ${minReps} reps (${repsText(last.reps)}).`,
      `Keep ${kg(w)} and aim for at least ${minReps} reps on every set.`,
    ]);
  }

  // B: in range, not every set at the top yet.
  const reasons = [`${repsText(last.reps)} at ${kg(w)}: in your ${minReps}–${maxReps} range, but not every set at ${maxReps} yet.`];
  if (t1 === "up" && prev?.weight === w) reasons.push(`Up from ${repsText(prev.reps)} last time, keep going.`);
  reasons.push(`Keep ${kg(w)} and add a rep where you can. At ${maxReps} on every set, the weight goes up.`);
  return result("more_reps", w, plusOne, reasons);
}

/** Planned set count for an exercise, from the routine the session came from. */
const plannedSetsFor = (state: AppState, session: Session, exerciseId: string): number | undefined =>
  state.routines.find((r) => r.id === session.routineId)?.exercises.find((re) => re.exerciseId === exerciseId)?.sets;

export function buildAdvice(state: AppState, exerciseId: string): AdviceResult | null {
  const sessions = recentSessions(state.workouts, exerciseId);
  if (sessions.length === 0) return null;
  const r = analyze(sessions, getProgression(state, exerciseId), plannedSetsFor(state, sessions[0], exerciseId));
  return r && { ...r, exerciseId };
}

const ADVICE_FIELDS = [
  "exerciseId", "basedOnWorkoutId", "status", "lastWeight", "lastReps", "lastDate", "recommendedWeight", "targetReps", "reasons",
] as const;
const sameAdvice = (a: OverloadAdvice, b: AdviceResult) =>
  ADVICE_FIELDS.every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k]));

/**
 * Recompute stored advice for some exercises (all when omitted). Unchanged advice keeps its
 * object, so syncing doesn't see a change.
 */
export function refreshAdvice(state: AppState, exerciseIds?: string[], now = Date.now()): AppState {
  const ids = new Set(
    exerciseIds ?? [...state.workouts.flatMap((w) => w.exercises.map((we) => we.exerciseId)), ...state.advice.map((a) => a.exerciseId)]
  );
  let changed = false;
  const byId = new Map(state.advice.map((a) => [a.exerciseId, a]));
  for (const id of ids) {
    const cur = byId.get(id);
    const next = buildAdvice(state, id);
    if (!next) {
      if (cur) { byId.delete(id); changed = true; }
      continue;
    }
    if (cur && sameAdvice(cur, next)) continue;
    byId.set(id, { ...next, updatedAt: now });
    changed = true;
  }
  return changed ? { ...state, advice: [...byId.values()] } : state;
}

export const STATUS_LABEL: Record<AdviceStatus, string> = {
  increase: "Ready to increase",
  more_reps: "Build more reps",
  hold: "Keep going",
  stagnation: "Progress has stalled",
  decline: "Performance declining",
  decrease: "Reduce weight",
};

/** Colour family per status: good = green, info = blue, warn = orange, bad = red. */
export const STATUS_TONE: Record<AdviceStatus, "good" | "info" | "warn" | "bad"> = {
  increase: "good",
  more_reps: "info",
  hold: "info",
  stagnation: "warn",
  decline: "warn",
  decrease: "bad",
};

/** One-line explanation for the card; the full analysis is in `reasons`. */
export function shortReason(a: OverloadAdvice, p: ProgressionSettings): string {
  const w = `${round2(a.lastWeight)} kg`;
  switch (a.status) {
    case "increase": return `Every set hit ${p.maxReps}. Add ${round2(a.recommendedWeight - a.lastWeight)} kg and restart at ${p.minReps} reps.`;
    case "more_reps": return `Same weight, one more rep where you can. At ${p.maxReps} on every set, the weight goes up.`;
    case "hold": return `Keep ${w} and match or beat last time.`;
    case "stagnation": return `Three sessions at the same level. Keep ${w} and go for one extra rep.`;
    case "decline": return `Reps dropped two sessions in a row. Keep ${w} and check your recovery.`;
    case "decrease": return `Below ${p.minReps} reps for several sessions. Drop a little and build back up.`;
  }
}

export interface LiveProgress {
  text: string;
  tone: "good" | "info" | "warn";
}

/** How today's ticked sets compare with last time, so the card reflects what's happening now. */
export function liveProgress(a: OverloadAdvice, sets: { weight: number; reps: number; done: boolean }[]): LiveProgress | null {
  const done = sets.filter((s) => s.done && s.reps > 0);
  if (done.length === 0) return null;
  const top = Math.max(...done.map((s) => s.weight));
  const working = done.filter((s) => s.weight === top).map((s) => s.reps);
  if (top > a.lastWeight) return { text: `+${round2(top - a.lastWeight)} kg vs last time`, tone: "good" };
  if (top < a.lastWeight) return { text: "Lighter than last time", tone: "info" };
  const k = Math.min(working.length, a.lastReps.length);
  const diff = sum(working.slice(0, k)) - sum(a.lastReps.slice(0, k));
  if (diff > 0) return { text: `+${diff} rep${diff === 1 ? "" : "s"} vs last time`, tone: "good" };
  if (diff < 0) return { text: `${diff} rep${diff === -1 ? "" : "s"} vs last time`, tone: "warn" };
  return { text: "Matching last time", tone: "info" };
}

type SetLike = { weight: number; reps: number; done: boolean };

/** How a ticked set compares with the same set last time. */
export type SetResult = "up" | "same" | "down";

export interface LastComparison {
  /** Per set, in order: up / same / down vs the same set last time; null = not ticked yet or a warm-up. */
  perSet: (SetResult | null)[];
  up: number;
  same: number;
  down: number;
}

/**
 * Compare each ticked set with the same set last time (set 1 with set 1, and so on), so a normal
 * drop in reps over the sets (10, 9, 8) isn't flagged when it happened last time as well.
 * More weight is better, less weight is worse; at the same weight, reps decide. A set with no
 * counterpart last time (an extra set) isn't judged. Ticked sets lighter than last time's
 * working weight count as warm-ups, unless every ticked set is lighter.
 */
export function compareToLast(a: OverloadAdvice, sets: SetLike[]): LastComparison {
  const done = sets.filter((s) => s.done && s.reps > 0);
  const allLighter = done.length > 0 && done.every((s) => s.weight < a.lastWeight);
  let k = 0;
  const perSet = sets.map((s): SetResult | null => {
    if (!s.done || s.reps <= 0) return null;
    if (s.weight < a.lastWeight && !allLighter) return null; // warm-up
    const prev = a.lastReps[k];
    k += 1;
    if (prev === undefined) return null; // no set to compare with
    if (s.weight > a.lastWeight) return "up";
    if (s.weight < a.lastWeight) return "down";
    return s.reps > prev ? "up" : s.reps < prev ? "down" : "same";
  });
  const count = (r: SetResult) => perSet.filter((x) => x === r).length;
  return { perSet, up: count("up"), same: count("same"), down: count("down") };
}
