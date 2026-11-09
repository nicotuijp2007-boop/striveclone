export type Muscle =
  | "Chest" | "Back" | "Legs" | "Shoulders" | "Arms" | "Core" | "Full body" | "Cardio";

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
  settings: Settings;
  /** Deletion markers ("workout:<id>", "bw:<date>", ...) → time deleted, so sync doesn't bring deleted items back. */
  deleted: Record<string, number>;
}
