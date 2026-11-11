import type { AppState, Exercise, Routine, SetEntry, Settings, VideoRef, Workout } from "./types";
import { DEFAULT_EXERCISES, DEFAULT_ROUTINES, migrateExercises } from "./lib/exercises";
import { uid } from "./lib/id";
import { mergeStates, tombstone, untombstone, type SyncedData } from "./sync/merge";

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
  videoChoices: [],
  deleted: {},
  settings: { restSeconds: 90, autoRest: true },
});

export const loadState = (): AppState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const base = initialState();
    return migrateExercises({ ...base, ...parsed, settings: { ...base.settings, ...parsed.settings } });
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
  | { type: "setExerciseVideo"; exerciseId: string; video: VideoRef | null | "default"; now?: number }
  | { type: "updateSettings"; patch: Partial<Settings> }
  | { type: "importState"; state: AppState }
  /** Combine data pulled from the cloud into the current state. */
  | { type: "mergeRemote"; remote: Partial<SyncedData> }
  /** Wipe local data, e.g. after signing out. */
  | { type: "reset" };

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

/** Every deletable item's key, as used in `deleted`. */
const itemKeys = (s: AppState): string[] => [
  ...s.workouts.map((w) => `workout:${w.id}`),
  ...s.routines.map((r) => `routine:${r.id}`),
  ...s.manualPRs.map((m) => `manualPR:${m.id}`),
  ...s.trackedPRs.map((t) => `tracked:${t.exerciseId}`),
  ...s.bodyWeight.map((b) => `bw:${b.date}`),
];

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
      return tombstone({ ...state, workouts: state.workouts.filter((w) => w.id !== action.id) }, `workout:${action.id}`);
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
      return tombstone({ ...state, routines: state.routines.filter((r) => r.id !== action.id) }, `routine:${action.id}`);
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
        ...untombstone(state, `bw:${action.date}`),
        bodyWeight: [...rest, { date: action.date, kg: action.kg }].sort((a, b) => a.date.localeCompare(b.date)),
      };
    }
    case "deleteBodyWeight":
      return tombstone({ ...state, bodyWeight: state.bodyWeight.filter((b) => b.date !== action.date) }, `bw:${action.date}`);
    case "trackPR":
      if (state.trackedPRs.some((t) => t.exerciseId === action.exerciseId)) return state;
      return {
        ...untombstone(state, `tracked:${action.exerciseId}`),
        trackedPRs: [...state.trackedPRs, { exerciseId: action.exerciseId, goalKg: action.goalKg }],
      };
    case "untrackPR":
      return tombstone(
        { ...state, trackedPRs: state.trackedPRs.filter((t) => t.exerciseId !== action.exerciseId) },
        `tracked:${action.exerciseId}`
      );
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
      return tombstone({ ...state, manualPRs: state.manualPRs.filter((m) => m.id !== action.id) }, `manualPR:${action.id}`);
    case "setExerciseVideo":
      return {
        ...state,
        videoChoices: [
          ...state.videoChoices.filter((c) => c.exerciseId !== action.exerciseId),
          { exerciseId: action.exerciseId, video: action.video, at: action.now ?? Date.now() },
        ],
      };
    case "updateSettings":
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case "importState": {
      // Mark everything not in the backup as deleted, so a signed-in sync doesn't merge it back.
      const next: AppState = { ...initialState(), ...action.state, active: state.active };
      const keep = new Set(itemKeys(next));
      const deleted = { ...next.deleted };
      for (const k of itemKeys(state)) if (!keep.has(k)) deleted[k] = Date.now();
      return migrateExercises({ ...next, deleted });
    }
    case "mergeRemote":
      // Another device may still use older muscle groups or exercises.
      return migrateExercises(mergeStates(state, action.remote));
    case "reset":
      return initialState();
  }
}
