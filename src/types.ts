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
  updatedAt: number;
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

/**
 * One night of sleep tracking. Timestamps are ms since epoch; `date` is the local calendar date of
 * the wake-up when it was saved (one entry per date), so entries are easy to look up by day.
 */
export interface SleepEntry {
  id: string;
  date: string; // YYYY-MM-DD, the morning the night ended
  bedAt: number;
  wakeAt: number;
  /** Time in bed (wakeAt - bedAt), in minutes. */
  minutes: number;
  createdAt: number;
  updatedAt: number;
}

export type ThemeMode = "system" | "light" | "dark" | "midnight" | "forest" | "sand" | "custom";

/** A theme the user builds in Settings: a base (its text and status colours) plus their own key colours. */
export interface CustomTheme {
  base: "dark" | "light";
  /** Hex colours, "#rrggbb" in lower case. */
  accent: string;
  bg: string;
  surface: string;
}
export type DashboardMonths = 1 | 3 | 6 | 12;

/** Home dashboard layout. Tile ids: "week", "bodyweight", "lift:<exerciseId>". */
export interface DashboardLayout {
  order: string[]; // tiles not listed here (e.g. a newly tracked lift) go after these
  hidden: string[];
  months: DashboardMonths;
}

export interface Settings {
  /** Off: the rest timer never starts by itself, and the rest bar and workout button are hidden. */
  restEnabled: boolean;
  restSeconds: number;
  autoRest: boolean;
  restSound: boolean;
  restVibrate: boolean;
  theme: ThemeMode;
  /** Used when theme is "custom"; kept when another theme is picked, so it can be picked again. */
  customTheme: CustomTheme;
  /** Keep the screen on during a workout (Wake Lock API, where supported). */
  keepAwake: boolean;
  /** New sets copy weight and reps from the last time the exercise was done. */
  prefillSets: boolean;
  dashboard: DashboardLayout;
  /** Optional sleep tracking: the Sleep tab, its dashboard tile and the morning check-in. */
  sleepTracking: boolean;
  /** When the settings last changed; the latest change wins when devices sync. 0 = never changed. */
  updatedAt: number;
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
  videoChoices: VideoChoice[];
  /** Nights in bed, newest first. Kept when sleep tracking is turned off. */
  sleep: SleepEntry[];
  /** Mornings (YYYY-MM-DD) whose check-in was skipped, so it isn't shown again. */
  sleepSkips: string[];
  settings: Settings;
  /** Deletion markers ("workout:<id>", "bw:<date>", ...) → time deleted, so sync doesn't bring deleted items back. */
  deleted: Record<string, number>;
}
