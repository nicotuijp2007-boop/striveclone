export type Muscle = "Chest" | "Back" | "Legs" | "Shoulders" | "Biceps" | "Triceps" | "Core";

export interface Exercise {
  id: string;
  name: string;
  muscle: Muscle;
  custom?: boolean;
}

export interface SetEntry {
  id: string;
  reps: number;
  weight: number; // kg
  done: boolean;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  sets: SetEntry[];
}

export interface Workout {
  id: string;
  name: string;
  routineId?: string;
  startedAt: number;
  finishedAt?: number;
  exercises: WorkoutExercise[];
}

export interface RoutineExercise {
  exerciseId: string;
  sets: number;
  reps: number;
  weight: number;
}

export interface Routine {
  id: string;
  name: string;
  exercises: RoutineExercise[];
}

export interface BodyWeightEntry {
  date: string; // YYYY-MM-DD
  kg: number;
}

/** A lift the user explicitly wants to follow, with an optional goal (estimated 1RM, kg). */
export interface TrackedPR {
  exerciseId: string;
  goalKg?: number;
}

/** A best set entered by hand, e.g. one lifted before using the app. */
export interface ManualPR {
  id: string;
  exerciseId: string;
  weight: number;
  reps: number;
  date: number;
}

/** A YouTube video, optionally starting part-way in. */
export interface VideoRef {
  id: string;
  start?: number; // seconds
  end?: number; // seconds; the player stops here
}

/** The user's choice of form video for an exercise: their own link, none, or back to the default. */
export interface VideoChoice {
  exerciseId: string;
  video: VideoRef | null | "default";
  at: number; // when chosen; the latest choice wins when devices sync
}

export interface Settings {
  restSeconds: number;
  autoRest: boolean;
}

export interface AppState {
  version: 1;
  exercises: Exercise[];
  routines: Routine[];
  workouts: Workout[]; // finished workouts, newest first
  active: Workout | null;
  bodyWeight: BodyWeightEntry[]; // sorted by date ascending
  trackedPRs: TrackedPR[];
  manualPRs: ManualPR[];
  videoChoices: VideoChoice[];
  settings: Settings;
  /** Deletion markers ("workout:<id>", "bw:<date>", ...) → time deleted, so sync doesn't bring deleted items back. */
  deleted: Record<string, number>;
}
