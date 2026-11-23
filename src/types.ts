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

/** Per-exercise progressive overload settings. Only stored once the user changes the defaults. */
export interface ProgressionSettings {
  exerciseId: string;
  minReps: number;
  maxReps: number;
  /** kg added when every working set hits maxReps; also the smallest step the equipment allows. */
  increment: number;
  enabled: boolean;
  updatedAt: number;
}

export type AdviceStatus =
  | "increase"   // all working sets hit the top of the range
  | "more_reps"  // in range, keep the weight and add reps
  | "hold"       // keep the weight (first session, one off day, missed sets)
  | "stagnation" // three sessions at the same level
  | "decline"    // reps dropping session after session
  | "decrease";  // structurally below the range: lower the weight a little

/** Advice for the next time an exercise is done, generated when a workout is finished. */
export interface OverloadAdvice {
  exerciseId: string;
  /** The workout whose results drive this advice (the latest valid session). */
  basedOnWorkoutId: string;
  status: AdviceStatus;
  lastWeight: number;
  lastReps: number[];
  lastDate: number;
  recommendedWeight: number;
  /** Target reps per working set for the next session. */
  targetReps: number[];
  reasons: string[];
  /** Weight the user chose instead of the recommendation; used as the new starting point. */
  adjustedWeight?: number;
  acceptedAt?: number;
  updatedAt: number;
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
  progression: ProgressionSettings[];
  advice: OverloadAdvice[];
  settings: Settings;
  /** Deletion markers ("workout:<id>", "bw:<date>", ...) → time deleted, so sync doesn't bring deleted items back. */
  deleted: Record<string, number>;
}
