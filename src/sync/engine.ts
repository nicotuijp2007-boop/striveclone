import { mergeStates, toSynced, type SyncedData } from "./merge";
import type { AppState } from "../types";

/** One cloud row per user: the synced data plus a revision number that increases on every write. */
export interface RemoteRow {
  data: Partial<SyncedData>;
  rev: number;
}

/** Storage the sync engine talks to; Supabase in the app, an in-memory fake in tests. */
export interface RemoteStore {
  fetch(): Promise<RemoteRow | null>;
  /** Create the row. Resolves false if it already exists. */
  insert(data: SyncedData): Promise<boolean>;
  /** Write only if the cloud is still at `expectedRev`. Resolves false if another device wrote first. */
  update(data: SyncedData, expectedRev: number): Promise<boolean>;
}

export interface SyncDeps {
  remote: RemoteStore;
  getState: () => AppState;
  /** Apply cloud data to the app (the reducer merges it into the latest state). */
  applyRemote: (data: Partial<SyncedData>) => void;
  /** Last cloud revision this device has seen or written, and the data it last wrote. */
  loadCursor: () => { rev: number; pushed: string } | null;
  saveCursor: (c: { rev: number; pushed: string }) => void;
}

/**
 * Bring this device and the cloud into agreement.
 *
 * - Cloud unchanged since our last sync: upload local changes, if any.
 * - Cloud changed (another device wrote): merge it in locally, then upload the merged result.
 * - Two devices writing at the same moment: the revision check makes one of them retry.
 */
export async function syncOnce(deps: SyncDeps, maxAttempts = 4): Promise<"uploaded" | "merged" | "unchanged"> {
  let merged = false;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const row = await deps.remote.fetch();
    const cursor = deps.loadCursor();
    let local = deps.getState();

    if (!row) {
      const data = toSynced(local);
      if (await deps.remote.insert(data)) {
        deps.saveCursor({ rev: 1, pushed: JSON.stringify(data) });
        return "uploaded";
      }
      continue; // another device created it first
    }

    if (!cursor || cursor.rev !== row.rev) {
      deps.applyRemote(row.data);
      // Same merge the reducer runs, so we upload exactly what the app now holds.
      local = mergeStates(local, row.data);
      merged = true;
    }

    const data = toSynced(local);
    const json = JSON.stringify(data);
    if (json === JSON.stringify(row.data)) {
      deps.saveCursor({ rev: row.rev, pushed: json });
      return merged ? "merged" : "unchanged";
    }
    if (cursor && cursor.rev === row.rev && cursor.pushed === json) return "unchanged";

    if (await deps.remote.update(data, row.rev)) {
      deps.saveCursor({ rev: row.rev + 1, pushed: json });
      return merged ? "merged" : "uploaded";
    }
    // Lost a race with another device: fetch again and merge.
  }
  throw new Error("Sync kept conflicting with another device; will retry shortly.");
}
