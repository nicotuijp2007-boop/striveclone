import { describe, expect, it } from "vitest";
import { initialState, loadState, reducer, STORAGE_KEY } from "./store";

describe("reducer", () => {
  it("starts a workout from a routine and saves only completed sets", () => {
    let s = reducer(initialState(), { type: "startWorkout", routineId: "starter-a", now: 1000 });
    expect(s.active?.exercises).toHaveLength(3);
    const we = s.active!.exercises[0];
    s = reducer(s, { type: "updateSet", workoutExerciseId: we.id, setId: we.sets[0].id, patch: { done: true, weight: 62.5 } });
    s = reducer(s, { type: "finishWorkout", now: 5000 });
    expect(s.active).toBeNull();
    expect(s.workouts).toHaveLength(1);
    expect(s.workouts[0].exercises).toHaveLength(1);
    expect(s.workouts[0].exercises[0].sets).toEqual([expect.objectContaining({ weight: 62.5, done: true })]);
  });

  it("prefills sets from the last time an exercise was done", () => {
    let s = reducer(initialState(), { type: "startWorkout" });
    s = reducer(s, { type: "addExerciseToWorkout", exerciseId: "curl" });
    const we = s.active!.exercises[0];
    s = reducer(s, { type: "updateSet", workoutExerciseId: we.id, setId: we.sets[0].id, patch: { done: true, weight: 30, reps: 10 } });
    s = reducer(s, { type: "finishWorkout" });
    s = reducer(s, { type: "startWorkout" });
    s = reducer(s, { type: "addExerciseToWorkout", exerciseId: "curl" });
    expect(s.active!.exercises[0].sets[0]).toMatchObject({ weight: 30, reps: 10, done: false });
  });

  it("drops an empty workout on finish", () => {
    let s = reducer(initialState(), { type: "startWorkout" });
    s = reducer(s, { type: "finishWorkout" });
    expect(s.workouts).toHaveLength(0);
  });

  it("keeps body weight sorted and one entry per day", () => {
    let s = reducer(initialState(), { type: "logBodyWeight", date: "2026-11-09", kg: 80 });
    s = reducer(s, { type: "logBodyWeight", date: "2026-11-01", kg: 81 });
    s = reducer(s, { type: "logBodyWeight", date: "2026-11-09", kg: 79.5 });
    expect(s.bodyWeight).toEqual([{ date: "2026-11-01", kg: 81 }, { date: "2026-11-09", kg: 79.5 }]);
  });
});

describe("tracked PRs", () => {
  it("tracks a lift once, sets and clears a goal, and untracks", () => {
    let s = reducer(initialState(), { type: "trackPR", exerciseId: "bench" });
    s = reducer(s, { type: "trackPR", exerciseId: "bench" });
    expect(s.trackedPRs).toEqual([{ exerciseId: "bench", goalKg: undefined }]);
    s = reducer(s, { type: "setPRGoal", exerciseId: "bench", goalKg: 100 });
    expect(s.trackedPRs[0].goalKg).toBe(100);
    s = reducer(s, { type: "setPRGoal", exerciseId: "bench", goalKg: 0 });
    expect(s.trackedPRs[0].goalKg).toBeUndefined();
    s = reducer(s, { type: "untrackPR", exerciseId: "bench" });
    expect(s.trackedPRs).toEqual([]);
  });

  it("adds and deletes hand-entered PRs", () => {
    let s = reducer(initialState(), { type: "addManualPR", exerciseId: "squat", weight: 140, reps: 3, date: 1 });
    expect(s.manualPRs).toHaveLength(1);
    s = reducer(s, { type: "deleteManualPR", id: s.manualPRs[0].id });
    expect(s.manualPRs).toHaveLength(0);
  });
});

describe("loading saved data", () => {
  const load = (saved: unknown) => {
    const store = new Map([[STORAGE_KEY, JSON.stringify(saved)]]);
    (globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: () => {} };
    return loadState();
  };
  // Data as an older version saved it: old muscle groups, no preacher curls, burpee and rowing built in.
  const old = () => ({
    ...initialState(),
    exercises: [
      ...initialState().exercises.filter((e) => !e.id.includes("preacher")).map((e) =>
        ["curl", "tricep-pushdown"].includes(e.id) ? { ...e, muscle: "Arms" } : e.id === "kb-swing" ? { ...e, muscle: "Full body" } : e),
      { id: "burpee", name: "Burpee", muscle: "Full body" },
      { id: "row-erg", name: "Rowing (calories as reps)", muscle: "Cardio" },
      { id: "custom-1", name: "Cable Curl", muscle: "Arms", custom: true },
      { id: "custom-2", name: "Skull Crusher", muscle: "Arms", custom: true },
      { id: "custom-3", name: "Sled Push", muscle: "Cardio", custom: true },
    ],
    workouts: [{ id: "w", name: "w", startedAt: 1, finishedAt: 2,
      exercises: [{ id: "we", exerciseId: "row-erg", sets: [{ id: "s", reps: 20, weight: 0, done: true }] }] }],
  });

  it("adds built-in exercises introduced after the data was saved", () => {
    const ids = load(old()).exercises.map((e) => e.id);
    expect(ids).toContain("preacher-curl");
    expect(ids).toContain("db-preacher-curl");
    expect(ids).toContain("custom-1");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("moves exercises to the current muscle groups", () => {
    const muscle = (id: string) => load(old()).exercises.find((e) => e.id === id)?.muscle;
    expect(muscle("curl")).toBe("Biceps");
    expect(muscle("tricep-pushdown")).toBe("Triceps");
    expect(muscle("kb-swing")).toBe("Legs");
    expect(muscle("custom-1")).toBe("Biceps");
    expect(muscle("custom-2")).toBe("Triceps");
    expect(muscle("custom-3")).toBe("Legs");
    const groups = new Set(load(old()).exercises.map((e) => e.muscle));
    expect([...groups].sort()).toEqual(["Back", "Biceps", "Chest", "Core", "Legs", "Shoulders", "Triceps"]);
  });

  it("removes retired exercises that were never used, and keeps ones that were", () => {
    const s = load(old());
    expect(s.exercises.find((e) => e.id === "burpee")).toBeUndefined();
    expect(s.deleted["exercise:burpee"]).toBeGreaterThan(0);
    expect(s.exercises.find((e) => e.id === "row-erg")?.muscle).toBe("Legs");
  });

  it("migrates data merged in from a device still on the old version", () => {
    const merged = reducer(initialState(), { type: "mergeRemote", remote: old() as never });
    expect(merged.exercises.find((e) => e.id === "curl")?.muscle).toBe("Biceps");
    expect(merged.exercises.find((e) => e.id === "burpee")).toBeUndefined();
    expect(merged.exercises.find((e) => e.id === "row-erg")).toBeDefined(); // used in a merged workout
  });
});
