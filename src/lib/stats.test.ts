import { describe, expect, it } from "vitest";
import { bestEst1RM, estimate1RM, exerciseHistory, trendOver, weekReport, personalRecords, weekStreak, weeklySummary, workoutVolume } from "./stats";
import type { Workout } from "../types";

const day = 864e5;
const mk = (startedAt: number, exerciseId: string, sets: [number, number, boolean?][]): Workout => ({
  id: String(startedAt),
  name: "w",
  startedAt,
  finishedAt: startedAt + 3600e3,
  exercises: [{ id: "we", exerciseId, sets: sets.map(([weight, reps, done = true], i) => ({ id: String(i), weight, reps, done })) }],
});

describe("stats", () => {
  it("estimates 1RM with Epley and handles edge cases", () => {
    expect(estimate1RM(100, 1)).toBe(100);
    expect(estimate1RM(100, 0)).toBe(0);
    expect(estimate1RM(100, 10)).toBeCloseTo(133.33, 1);
  });

  it("counts volume only for completed sets", () => {
    expect(workoutVolume(mk(0, "bench", [[100, 5], [100, 5, false]]))).toBe(500);
  });

  it("builds exercise history oldest first", () => {
    const ws = [mk(2 * day, "bench", [[105, 5]]), mk(day, "bench", [[100, 5]]), mk(day, "squat", [[140, 5]])];
    const h = exerciseHistory(ws, "bench");
    expect(h.map((p) => p.topWeight)).toEqual([100, 105]);
  });

  it("picks the best set per exercise as the PR", () => {
    const prs = personalRecords([mk(0, "bench", [[100, 5], [90, 10]])]);
    expect(prs).toHaveLength(1);
    expect(prs[0]).toMatchObject({ weight: 90, reps: 10 }); // 120 est vs 116.7
  });

  it("buckets workouts per week and counts streaks", () => {
    const now = new Date(2026, 10, 11, 12).getTime(); // Wed
    const ws = [mk(now - day, "x", [[1, 1]]), mk(now - 7 * day, "x", [[1, 1]]), mk(now - 21 * day, "x", [[1, 1]])];
    const weeks = weeklySummary(ws, 4, now);
    expect(weeks.map((w) => w.workouts)).toEqual([1, 0, 1, 1]);
    expect(weekStreak(ws, now)).toBe(2);
  });
});

describe("records with hand-entered PRs", () => {
  it("lets a hand-entered PR beat logged sets and marks it", () => {
    const manual = [{ id: "m", exerciseId: "bench", weight: 112.5, reps: 1, date: 5 }];
    const [pr] = personalRecords([mk(0, "bench", [[100, 3]])], manual);
    expect(pr).toMatchObject({ weight: 112.5, reps: 1, manual: true });
  });

  it("computes best estimated 1RM across history, manual and extra sets", () => {
    const ws = [mk(0, "bench", [[100, 1]])];
    expect(bestEst1RM(ws, [], "bench")).toBe(100);
    expect(bestEst1RM(ws, [{ id: "m", exerciseId: "bench", weight: 105, reps: 1, date: 0 }], "bench")).toBe(105);
    expect(bestEst1RM(ws, [], "bench", [{ weight: 107.5, reps: 1 }])).toBe(107.5);
    expect(bestEst1RM(ws, [], "squat")).toBe(0);
  });
});

describe("weekReport", () => {
  const now = new Date(2026, 10, 12, 20).getTime(); // Thu
  const daysAgo = (n: number) => now - n * day;
  it("compares this week with the same point last week", () => {
    const ws = [
      mk(daysAgo(1), "bench", [[100, 5]]), mk(daysAgo(2), "squat", [[100, 5], [100, 5]]),
      mk(daysAgo(8), "bench", [[90, 5]]),
      mk(daysAgo(6), "bench", [[90, 5]]), // last Friday: after "this time last week", so not counted
    ];
    const r = weekReport(ws, [], now);
    expect(r.thisWeek).toMatchObject({ workouts: 2, sets: 3, volume: 1500 });
    expect(r.lastWeek).toMatchObject({ workouts: 1, sets: 1, volume: 450 });
  });

  it("reports one PR per exercise against everything before it, ignoring first-ever lifts", () => {
    const ws = [
      mk(daysAgo(10), "bench", [[90, 5]]), // before this week: 105 est
      mk(daysAgo(2), "bench", [[95, 5]]), // PR: 110.8
      mk(daysAgo(1), "bench", [[100, 5]]), // PR again: 116.7, previous stays 105
      mk(daysAgo(1), "squat", [[140, 5]]), // first time: not a PR
    ];
    const { newPRs } = weekReport(ws, [], now);
    expect(newPRs).toHaveLength(1);
    expect(newPRs[0]).toMatchObject({ exerciseId: "bench", weight: 100, reps: 5, previous: 105 });
  });

  it("counts hand-entered PRs from before this week as the bar to beat", () => {
    const ws = [mk(daysAgo(10), "bench", [[80, 5]]), mk(daysAgo(1), "bench", [[90, 5]])];
    expect(weekReport(ws, [{ id: "m", exerciseId: "bench", weight: 110, reps: 1, date: daysAgo(30) }], now).newPRs).toHaveLength(0);
  });
});

describe("trendOver", () => {
  const now = 100 * day;
  it("uses only points in the window and reports the change from first to latest", () => {
    const t = trendOver([{ t: now - 200 * day, v: 50 }, { t: now - 80 * day, v: 100 }, { t: now - 10 * day, v: 110 }], 90, now);
    expect(t.series.map((p) => p.v)).toEqual([100, 110]);
    expect(t).toMatchObject({ latest: 110, changePct: 10 });
  });
  it("has no change with a single point and nothing with none", () => {
    expect(trendOver([{ t: now - day, v: 80 }], 90, now)).toMatchObject({ latest: 80, changePct: null });
    expect(trendOver([], 90, now)).toMatchObject({ latest: null, changePct: null });
  });
});
