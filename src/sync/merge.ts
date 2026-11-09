import type { AppState } from "../types";

/** The part of the app state that is stored in the cloud. The in-progress workout stays on the device. */
export type SyncedData = Omit<AppState, "active">;

export const toSynced = ({ active: _active, ...rest }: AppState): SyncedData => rest;

/*
 * Deletion markers live in `state.deleted`, keyed like "workout:<id>" or "bw:<date>".
 * A positive value is the time the item was deleted. Some keys can be reused (tracking a lift
 * again, logging the same day's weight again), so re-adding writes a negative value: minus the
 * time it was restored. When two devices disagree, the most recent event wins.
 */

export const tombstone = (s: AppState, key: string): AppState => ({ ...s, deleted: { ...s.deleted, [key]: Date.now() } });

// Always recorded, because another device may hold a deletion this one hasn't seen yet.
export const untombstone = (s: AppState, key: string): AppState => ({ ...s, deleted: { ...s.deleted, [key]: -Date.now() } });

const isDeleted = (markers: Record<string, number>, key: string) => (markers[key] ?? 0) > 0;

/** Latest event per key across both devices. */
export function mergeMarkers(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const cur = out[k];
    // Later event wins; on an exact tie the delete wins, so every device reaches the same answer.
    if (cur === undefined || Math.abs(v) > Math.abs(cur) || (Math.abs(v) === Math.abs(cur) && v > cur)) out[k] = v;
  }
  return out;
}

/** Union by key, keeping the local version when both sides have an item, then drop deleted ones. */
function unionBy<T>(local: T[], remote: T[], key: (t: T) => string, markers: Record<string, number>): T[] {
  const out = new Map<string, T>();
  for (const r of remote) out.set(key(r), r);
  for (const l of local) out.set(key(l), l);
  return [...out.entries()].filter(([k]) => !isDeleted(markers, k)).map(([, v]) => v);
}

/**
 * Combine this device's state with the cloud copy. Lists are merged by id, the latest delete or
 * re-add wins, and settings and the in-progress workout come from this device.
 */
export function mergeStates(local: AppState, remote: Partial<SyncedData>): AppState {
  const deleted = mergeMarkers(local.deleted, remote.deleted ?? {});
  const merge = <T,>(l: T[], r: T[] | undefined, key: (t: T) => string) => unionBy(l, r ?? [], key, deleted);

  return {
    ...local,
    exercises: merge(local.exercises, remote.exercises, (e) => `exercise:${e.id}`),
    routines: merge(local.routines, remote.routines, (r) => `routine:${r.id}`),
    workouts: merge(local.workouts, remote.workouts, (w) => `workout:${w.id}`).sort((a, b) => b.startedAt - a.startedAt),
    bodyWeight: merge(local.bodyWeight, remote.bodyWeight, (b) => `bw:${b.date}`).sort((a, b) => a.date.localeCompare(b.date)),
    trackedPRs: merge(local.trackedPRs, remote.trackedPRs, (t) => `tracked:${t.exerciseId}`),
    manualPRs: merge(local.manualPRs, remote.manualPRs, (m) => `manualPR:${m.id}`),
    deleted,
  };
}
