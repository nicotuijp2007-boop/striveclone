import { describe, expect, it } from "vitest";
import { initialState, reducer } from "./store";

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
