import { describe, expect, it } from "vitest";
import { analyze, defaultProgression, recentSessions, type Session } from "./overload";
import { initialState, reducer } from "../store";
import type { AppState, Workout } from "../types";

const settings = { ...defaultProgression("bench"), increment: 2.5 };
/** Sessions newest first, all at `weight` unless given as [weight, reps]. */
const sessions = (...xs: (number[] | [number, number[]])[]): Session[] =>
  xs.map((x, i) => {
    const [weight, reps] = typeof x[1] === "object" ? (x as [number, number[]]) : [60, x as number[]];
    return { workoutId: `w${i}`, date: 1000 - i, weight, reps };
  });

describe("analyze (double progression)", () => {
  it("A: increases the weight when every working set hits the top of the range", () => {
    const a = analyze(sessions([10, 10, 10]), settings)!;
    expect(a.status).toBe("increase");
    expect(a.recommendedWeight).toBe(62.5);
    expect(a.targetReps).toEqual([6, 6, 6]);
  });

  it("uses the exercise's own increment", () => {
    const a = analyze(sessions([100, [10, 10]]), { ...settings, increment: 5 })!;
    expect(a.recommendedWeight).toBe(105);
  });

  it("holds when the top of the range is hit but planned sets are missing", () => {
    const a = analyze(sessions([10, 10]), settings, 3)!;
    expect(a.status).toBe("hold");
    expect(a.recommendedWeight).toBe(60);
  });

  it("B: keeps the weight and asks for more reps when in range", () => {
    for (const reps of [[10, 9, 8], [8, 8, 7]]) {
      const a = analyze(sessions(reps), settings)!;
      expect(a.status).toBe("more_reps");
      expect(a.recommendedWeight).toBe(60);
    }
    expect(analyze(sessions([10, 9, 8]), settings)!.targetReps).toEqual([10, 10, 9]);
  });

  it("decides on the latest session, not on an average of three", () => {
    // The average of these is well below 10, but the latest session hit 10/10/10.
    const a = analyze(sessions([10, 10, 10], [7, 7, 6], [6, 6, 6]), settings)!;
    expect(a.status).toBe("increase");
  });

  it("C: detects stagnation over three sessions without raising the weight", () => {
    const a = analyze(sessions([8, 8, 7], [8, 8, 7], [8, 8, 7]), settings)!;
    expect(a.status).toBe("stagnation");
    expect(a.recommendedWeight).toBe(60);
  });

  it("does not call it stagnation right after a weight increase", () => {
    const a = analyze(sessions([8, 8, 7], [57.5, [10, 10, 10]], [57.5, [9, 9, 9]]), settings)!;
    expect(a.status).toBe("more_reps");
  });

  it("counts 8/8/7 → 9/9/8 as progress, never as stagnation", () => {
    for (const hist of [sessions([9, 9, 8], [8, 8, 7], [8, 8, 7]), sessions([9, 9, 8], [8, 8, 7]), sessions([9, 9, 8], [8, 8, 7], [9, 9, 8])]) {
      expect(analyze(hist, settings)!.status).toBe("more_reps");
    }
  });

  it("D: warns on a falling trend but keeps the weight", () => {
    const a = analyze(sessions([7, 7, 6], [8, 8, 7], [9, 9, 8]), settings)!;
    expect(a.status).toBe("decline");
    expect(a.recommendedWeight).toBe(60);
  });

  it("D: suggests a small decrease only when structurally below the range", () => {
    const a = analyze(sessions([5, 4, 4], [6, 5, 5], [7, 6, 6]), settings)!;
    expect(a.status).toBe("decrease");
    expect(a.recommendedWeight).toBe(52.5); // 60 × 0.9 = 54, rounded down to a 2.5 kg step
  });

  it("never lowers the weight after one bad session", () => {
    const a = analyze(sessions([4, 4, 3], [9, 9, 8], [8, 8, 8]), settings)!;
    expect(a.status).toBe("hold");
    expect(a.recommendedWeight).toBe(60);
  });

  it("gives nothing when progression is off for the exercise", () => {
    expect(analyze(sessions([10, 10, 10]), { ...settings, enabled: false })).toBeNull();
  });
});

describe("recentSessions", () => {
  it("uses the top-weight sets as working sets, skips warm-ups and unticked sets", () => {
    const w: Workout = {
      id: "a", name: "", startedAt: 1, exercises: [{
        id: "x", exerciseId: "bench", sets: [
          { id: "1", weight: 40, reps: 10, done: true },
          { id: "2", weight: 60, reps: 9, done: true },
          { id: "3", weight: 60, reps: 8, done: true },
          { id: "4", weight: 60, reps: 8, done: false },
        ],
      }],
    };
    expect(recentSessions([w], "bench")).toEqual([{ workoutId: "a", routineId: undefined, date: 1, weight: 60, reps: [9, 8] }]);
  });
});

describe("advice in the app flow", () => {
  const doBench = (s: AppState, weight: number, reps: number[]): AppState => {
    s = reducer(s, { type: "startWorkout" });
    s = reducer(s, { type: "addExerciseToWorkout", exerciseId: "bench" });
    const we = s.active!.exercises[0];
    while (s.active!.exercises[0].sets.length < reps.length) s = reducer(s, { type: "addSet", workoutExerciseId: we.id });
    s.active!.exercises[0].sets.forEach((set, i) => {
      s = reducer(s, { type: "updateSet", workoutExerciseId: we.id, setId: set.id, patch: { weight, reps: reps[i], done: true } });
    });
    return reducer(s, { type: "finishWorkout" });
  };

  it("stores advice on finish and prefills the next session with it", () => {
    let s = doBench(initialState(), 60, [10, 10, 10]);
    expect(s.advice).toEqual([expect.objectContaining({ exerciseId: "bench", status: "increase", recommendedWeight: 62.5 })]);
    s = reducer(s, { type: "startWorkout" });
    s = reducer(s, { type: "addExerciseToWorkout", exerciseId: "bench" });
    expect(s.active!.exercises[0].sets.map((x) => [x.weight, x.reps])).toEqual([[62.5, 6], [62.5, 6], [62.5, 6]]);
  });

  it("keeps an adjusted weight as the new starting point without touching history", () => {
    let s = doBench(initialState(), 60, [10, 10, 10]);
    s = reducer(s, { type: "startWorkout" });
    s = reducer(s, { type: "addExerciseToWorkout", exerciseId: "bench" });
    s = reducer(s, { type: "adjustAdvice", exerciseId: "bench", weight: 61 });
    expect(s.active!.exercises[0].sets.every((x) => x.weight === 61)).toBe(true);
    expect(s.advice[0].adjustedWeight).toBe(61);
    expect(s.workouts[0].exercises[0].sets.every((x) => x.weight === 60)).toBe(true);
    s = reducer(s, { type: "acceptAdvice", exerciseId: "bench" });
    expect(s.active!.exercises[0].sets.every((x) => x.weight === 62.5)).toBe(true);
    expect(s.advice[0].adjustedWeight).toBeUndefined();
  });

  it("recomputes advice when the rep range changes", () => {
    let s = doBench(initialState(), 60, [10, 10, 10]);
    s = reducer(s, { type: "setProgression", exerciseId: "bench", patch: { maxReps: 12 } });
    expect(s.advice[0].status).toBe("more_reps");
  });

  it("is stable: recomputing without changes keeps the same state", () => {
    const s = doBench(initialState(), 60, [10, 9, 8]);
    expect(reducer(s, { type: "mergeRemote", remote: {} }).advice[0]).toBe(s.advice[0]);
  });
});
