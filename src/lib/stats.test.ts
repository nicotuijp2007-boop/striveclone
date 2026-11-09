import { describe, expect, it } from "vitest";
import { bestEst1RM, estimate1RM, exerciseHistory, personalRecords, weekStreak, weeklySummary, workoutVolume } from "./stats";
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
