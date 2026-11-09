import type { AppState, Exercise, Routine, SetEntry, Settings, Workout } from "./types";
import { DEFAULT_EXERCISES, DEFAULT_ROUTINES } from "./lib/exercises";
import { uid } from "./lib/id";

export const STORAGE_KEY = "liftlog:v1";

export const initialState = (): AppState => ({
  version: 1,
  exercises: DEFAULT_EXERCISES,
  routines: DEFAULT_ROUTINES,
  workouts: [],
  active: null,
  bodyWeight: [],
  trackedPRs: [],
  manualPRs: [],
  settings: { restSeconds: 90, autoRest: true },
});

export const loadState = (): AppState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return { ...initialState(), ...parsed, settings: { ...initialState().settings, ...parsed.settings } };
  } catch {
    return initialState();
  }
};

export const saveState = (state: AppState): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full or unavailable */
  }
};

export type Action =
  | { type: "startWorkout"; routineId?: string; now?: number }
  | { type: "renameWorkout"; name: string }
  | { type: "addExerciseToWorkout"; exerciseId: string }
  | { type: "removeExerciseFromWorkout"; workoutExerciseId: string }
  | { type: "addSet"; workoutExerciseId: string }
  | { type: "updateSet"; workoutExerciseId: string; setId: string; patch: Partial<Omit<SetEntry, "id">> }
  | { type: "removeSet"; workoutExerciseId: string; setId: string }
  | { type: "finishWorkout"; now?: number }
  | { type: "discardWorkout" }
  | { type: "deleteWorkout"; id: string }
  | { type: "saveRoutine"; routine: Routine }
  | { type: "deleteRoutine"; id: string }
  | { type: "saveWorkoutAsRoutine"; workoutId: string }
  | { type: "addExercise"; exercise: Omit<Exercise, "id" | "custom"> }
  | { type: "logBodyWeight"; date: string; kg: number }
  | { type: "deleteBodyWeight"; date: string }
  | { type: "trackPR"; exerciseId: string; goalKg?: number }
  | { type: "untrackPR"; exerciseId: string }
  | { type: "setPRGoal"; exerciseId: string; goalKg?: number }
  | { type: "addManualPR"; exerciseId: string; weight: number; reps: number; date: number }
  | { type: "deleteManualPR"; id: string }
  | { type: "updateSettings"; patch: Partial<Settings> }
  | { type: "importState"; state: AppState };

const newSet = (reps: number, weight: number): SetEntry => ({ id: uid(), reps, weight, done: false });

/** Last completed sets of an exercise, used to prefill new sets. */
const lastPerformance = (state: AppState, exerciseId: string): SetEntry[] | undefined => {
  for (const w of state.workouts) {
    const we = w.exercises.find((x) => x.exerciseId === exerciseId);
    if (we && we.sets.length) return we.sets;
  }
  return undefined;
};

const mapActive = (state: AppState, fn: (w: Workout) => Workout): AppState =>
  state.active ? { ...state, active: fn(state.active) } : state;

const mapExercise = (
  state: AppState,
  workoutExerciseId: string,
  fn: (sets: SetEntry[]) => SetEntry[]
): AppState =>
  mapActive(state, (w) => ({
    ...w,
    exercises: w.exercises.map((we) => (we.id === workoutExerciseId ? { ...we, sets: fn(we.sets) } : we)),
  }));

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "startWorkout": {
      if (state.active) return state;
      const routine = state.routines.find((r) => r.id === action.routineId);
      const now = action.now ?? Date.now();
      const workout: Workout = {
        id: uid(),
        name: routine?.name ?? `Workout ${new Date(now).toLocaleDateString(undefined, { weekday: "long" })}`,
        routineId: routine?.id,
        startedAt: now,
        exercises: (routine?.exercises ?? []).map((re) => ({
          id: uid(),
          exerciseId: re.exerciseId,
          sets: Array.from({ length: Math.max(1, re.sets) }, () => newSet(re.reps, re.weight)),
        })),
      };
      return { ...state, active: workout };
    }
    case "renameWorkout":
      return mapActive(state, (w) => ({ ...w, name: action.name }));
    case "addExerciseToWorkout": {
      const prev = lastPerformance(state, action.exerciseId);
      const sets = prev ? prev.map((s) => newSet(s.reps, s.weight)) : [newSet(8, 0)];
      return mapActive(state, (w) => ({
        ...w,
        exercises: [...w.exercises, { id: uid(), exerciseId: action.exerciseId, sets }],
      }));
    }
    case "removeExerciseFromWorkout":
      return mapActive(state, (w) => ({
        ...w,
        exercises: w.exercises.filter((we) => we.id !== action.workoutExerciseId),
      }));
    case "addSet":
      return mapExercise(state, action.workoutExerciseId, (sets) => {
        const last = sets[sets.length - 1];
        return [...sets, newSet(last?.reps ?? 8, last?.weight ?? 0)];
      });
    case "updateSet":
      return mapExercise(state, action.workoutExerciseId, (sets) =>
        sets.map((s) => (s.id === action.setId ? { ...s, ...action.patch } : s))
      );
    case "removeSet":
      return mapExercise(state, action.workoutExerciseId, (sets) => sets.filter((s) => s.id !== action.setId));
    case "finishWorkout": {
      if (!state.active) return state;
      const exercises = state.active.exercises
        .map((we) => ({ ...we, sets: we.sets.filter((s) => s.done) }))
        .filter((we) => we.sets.length > 0);
      if (exercises.length === 0) return { ...state, active: null };
      const finished: Workout = { ...state.active, exercises, finishedAt: action.now ?? Date.now() };
      return { ...state, active: null, workouts: [finished, ...state.workouts] };
    }
    case "discardWorkout":
      return { ...state, active: null };
    case "deleteWorkout":
      return { ...state, workouts: state.workouts.filter((w) => w.id !== action.id) };
    case "saveRoutine": {
      const exists = state.routines.some((r) => r.id === action.routine.id);
      return {
        ...state,
        routines: exists
          ? state.routines.map((r) => (r.id === action.routine.id ? action.routine : r))
          : [...state.routines, action.routine],
      };
    }
    case "deleteRoutine":
      return { ...state, routines: state.routines.filter((r) => r.id !== action.id) };
    case "saveWorkoutAsRoutine": {
      const w = state.workouts.find((x) => x.id === action.workoutId);
      if (!w) return state;
      const routine: Routine = {
        id: uid(),
        name: w.name,
        exercises: w.exercises.map((we) => {
          const top = we.sets.reduce((a, b) => (b.weight > a.weight ? b : a), we.sets[0]);
          return { exerciseId: we.exerciseId, sets: we.sets.length, reps: top.reps, weight: top.weight };
        }),
      };
      return { ...state, routines: [...state.routines, routine] };
    }
    case "addExercise":
      return {
        ...state,
        exercises: [...state.exercises, { ...action.exercise, id: uid(), custom: true }],
      };
    case "logBodyWeight": {
      const rest = state.bodyWeight.filter((b) => b.date !== action.date);
      return {
        ...state,
        bodyWeight: [...rest, { date: action.date, kg: action.kg }].sort((a, b) => a.date.localeCompare(b.date)),
      };
    }
    case "deleteBodyWeight":
      return { ...state, bodyWeight: state.bodyWeight.filter((b) => b.date !== action.date) };
    case "trackPR":
      if (state.trackedPRs.some((t) => t.exerciseId === action.exerciseId)) return state;
      return { ...state, trackedPRs: [...state.trackedPRs, { exerciseId: action.exerciseId, goalKg: action.goalKg }] };
    case "untrackPR":
      return { ...state, trackedPRs: state.trackedPRs.filter((t) => t.exerciseId !== action.exerciseId) };
    case "setPRGoal":
      return {
        ...state,
        trackedPRs: state.trackedPRs.map((t) =>
          t.exerciseId === action.exerciseId ? { ...t, goalKg: action.goalKg && action.goalKg > 0 ? action.goalKg : undefined } : t
        ),
      };
    case "addManualPR":
      return {
        ...state,
        manualPRs: [
          ...state.manualPRs,
          { id: uid(), exerciseId: action.exerciseId, weight: action.weight, reps: action.reps, date: action.date },
        ],
      };
    case "deleteManualPR":
      return { ...state, manualPRs: state.manualPRs.filter((m) => m.id !== action.id) };
    case "updateSettings":
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case "importState":
      return { ...initialState(), ...action.state };
  }
}
