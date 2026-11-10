import type { Exercise, Routine } from "../types";

const e = (id: string, name: string, muscle: Exercise["muscle"]): Exercise => ({ id, name, muscle });

export const DEFAULT_EXERCISES: Exercise[] = [
  e("bench", "Bench Press", "Chest"),
  e("incline-bench", "Incline Bench Press", "Chest"),
  e("incline-smith", "Incline Smith Machine Press", "Chest"),
  e("incline-db", "Incline Dumbbell Press", "Chest"),
  e("pushup", "Push-up", "Chest"),
  e("pec-deck", "Pec Deck Fly", "Chest"),
  e("deadlift", "Deadlift", "Back"),
  e("row", "Barbell Row", "Back"),
  e("pullup", "Pull-up", "Back"),
  e("lat-pulldown", "Lat Pulldown", "Back"),
  e("squat", "Back Squat", "Legs"),
  e("rdl", "Romanian Deadlift", "Legs"),
  e("leg-press", "Leg Press", "Legs"),
  e("lunge", "Walking Lunge", "Legs"),
  e("ohp", "Overhead Press", "Shoulders"),
  e("plate-shoulder-press", "Plate-Loaded Shoulder Press", "Shoulders"),
  e("lateral-raise", "Lateral Raise", "Shoulders"),
  e("cable-lateral-raise", "Cable Lateral Raise", "Shoulders"),
  e("cable-rear-delt-fly", "Cable Rear Delt Fly", "Shoulders"),
  e("reverse-pec-deck", "Reverse Pec Deck", "Shoulders"),
  e("curl", "Barbell Curl", "Arms"),
  e("preacher-curl", "Preacher Curl", "Arms"),
  e("db-preacher-curl", "Dumbbell Preacher Curl", "Arms"),
  e("tricep-pushdown", "Tricep Pushdown", "Arms"),
  e("plank", "Plank (seconds as reps)", "Core"),
  e("hanging-leg-raise", "Hanging Leg Raise", "Core"),
  e("kb-swing", "Kettlebell Swing", "Full body"),
  e("burpee", "Burpee", "Full body"),
  e("row-erg", "Rowing (calories as reps)", "Cardio"),
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
