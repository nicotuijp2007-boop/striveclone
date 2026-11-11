import type { AppState, Exercise, Muscle, Routine } from "../types";

/** Muscle groups, in the order the exercise picker shows them. */
export const MUSCLES: Muscle[] = ["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Legs", "Core"];

const e = (id: string, name: string, muscle: Exercise["muscle"]): Exercise => ({ id, name, muscle });

export const DEFAULT_EXERCISES: Exercise[] = [
  e("bench", "Bench Press", "Chest"),
  e("incline-bench", "Incline Bench Press", "Chest"),
  e("incline-smith", "Incline Smith Machine Press", "Chest"),
  e("incline-db", "Incline Dumbbell Press", "Chest"),
  e("pushup", "Push-up", "Chest"),
  e("pec-deck", "Pec Deck Fly", "Chest"),
  e("weighted-dips", "Weighted Dips (added kg)", "Chest"),
  e("deadlift", "Deadlift", "Back"),
  e("row", "Barbell Row", "Back"),
  e("t-bar-row", "T-Bar Row", "Back"),
  e("pullup", "Pull-up", "Back"),
  e("lat-pulldown", "Lat Pulldown", "Back"),
  e("squat", "Back Squat", "Legs"),
  e("rdl", "Romanian Deadlift", "Legs"),
  e("leg-press", "Leg Press", "Legs"),
  e("leg-extension", "Leg Extension", "Legs"),
  e("leg-curl", "Leg Curl", "Legs"),
  e("sldl", "Stiff-Leg Deadlift (SLDL)", "Legs"),
  e("lunge", "Walking Lunge", "Legs"),
  e("ohp", "Overhead Press", "Shoulders"),
  e("plate-shoulder-press", "Plate-Loaded Shoulder Press", "Shoulders"),
  e("lateral-raise", "Lateral Raise", "Shoulders"),
  e("cable-lateral-raise", "Cable Lateral Raise", "Shoulders"),
  e("cable-rear-delt-fly", "Cable Rear Delt Fly", "Shoulders"),
  e("reverse-pec-deck", "Reverse Pec Deck", "Shoulders"),
  e("curl", "Barbell Curl", "Biceps"),
  e("preacher-curl", "Preacher Curl", "Biceps"),
  e("db-preacher-curl", "Dumbbell Preacher Curl", "Biceps"),
  e("tricep-pushdown", "Tricep Pushdown", "Triceps"),
  e("one-arm-tricep-ext", "One-Arm Cable Tricep Pushdown", "Triceps"),
  e("plank", "Plank (seconds as reps)", "Core"),
  e("hanging-leg-raise", "Hanging Leg Raise", "Core"),
  e("kb-swing", "Kettlebell Swing", "Legs"),
];

export const DEFAULT_ROUTINES: Routine[] = [
  {
    id: "starter-a",
    name: "Full Body A",
    exercises: [
      { exerciseId: "squat", sets: 3, reps: 5, weight: 60 },
      { exerciseId: "bench", sets: 3, reps: 5, weight: 50 },
      { exerciseId: "row", sets: 3, reps: 8, weight: 40 },
    ],
  },
  {
    id: "starter-b",
    name: "Full Body B",
    exercises: [
      { exerciseId: "deadlift", sets: 1, reps: 5, weight: 80 },
      { exerciseId: "ohp", sets: 3, reps: 5, weight: 30 },
      { exerciseId: "pullup", sets: 3, reps: 8, weight: 0 },
    ],
  },
];

/** Built-in exercises that were removed; dropped from saved lists unless they were ever used. */
const RETIRED_EXERCISES = ["burpee", "row-erg"];

const TRICEPS_NAME = /tricep|pushdown|pressdown|extension|skull|kickback|dip|close.?grip/i;

/** Map a muscle group from an older version ("Arms", "Full body", "Cardio") to the current ones. */
function currentMuscle(e: Exercise): Muscle {
  const builtIn = DEFAULT_EXERCISES.find((d) => d.id === e.id);
  if (builtIn) return builtIn.muscle;
  const m = e.muscle as string;
  if (m === "Arms") return TRICEPS_NAME.test(e.name) ? "Triceps" : "Biceps";
  if (m === "Full body" || m === "Cardio") return "Legs";
  return MUSCLES.includes(e.muscle) ? e.muscle : "Core";
}

/**
 * Bring saved data from older versions up to date: current muscle groups, newly added built-in
 * exercises, and retired built-ins removed (with a deletion marker so sync doesn't bring them
 * back), unless the user ever logged or planned them.
 */
export function migrateExercises(state: AppState): AppState {
  const used = new Set<string>([
    ...state.workouts.flatMap((w) => w.exercises.map((we) => we.exerciseId)),
    ...(state.active?.exercises.map((we) => we.exerciseId) ?? []),
    ...state.routines.flatMap((r) => r.exercises.map((re) => re.exerciseId)),
    ...state.trackedPRs.map((t) => t.exerciseId),
    ...state.manualPRs.map((m) => m.exerciseId),
  ]);
  const retire = (e: Exercise) => RETIRED_EXERCISES.includes(e.id) && !e.custom && !used.has(e.id);
  const kept = state.exercises.filter((e) => !retire(e)).map((e) => {
    const muscle = currentMuscle(e);
    return muscle === e.muscle ? e : { ...e, muscle };
  });
  const added = DEFAULT_EXERCISES.filter((d) => !kept.some((e) => e.id === d.id));
  const deleted = { ...state.deleted };
  for (const e of state.exercises) if (retire(e) && !(deleted[`exercise:${e.id}`] > 0)) deleted[`exercise:${e.id}`] = Date.now();
  const unchanged = added.length === 0 && kept.length === state.exercises.length && kept.every((e, i) => e === state.exercises[i]);
  return unchanged ? state : { ...state, exercises: [...kept, ...added], deleted };
}
