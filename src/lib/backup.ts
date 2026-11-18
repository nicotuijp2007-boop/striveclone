import type { AppState } from "../types";

/** Download the whole app state as a JSON file. */
export function exportBackup(state: AppState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `liftlog-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Read a backup file; throws if it isn't one. */
export async function readBackup(file: File): Promise<AppState> {
  const data = JSON.parse(await file.text()) as AppState;
  if (!Array.isArray(data.workouts) || !Array.isArray(data.exercises)) throw new Error("bad file");
  return data;
}
