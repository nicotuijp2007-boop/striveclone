import { describe, expect, it } from "vitest";
import { initialState, reducer, type Action } from "../store";
import { syncOnce, type RemoteRow, type RemoteStore } from "./engine";
import { mergeStates, type SyncedData } from "./merge";
import type { AppState } from "../types";

/** In-memory stand-in for the Supabase table, with the same revision check. */
class FakeCloud {
  row: RemoteRow | null = null;
  store(): RemoteStore {
    return {
      fetch: async () => (this.row ? structuredClone(this.row) : null),
      insert: async (data) => {
        if (this.row) return false;
        this.row = { data: structuredClone(data), rev: 1 };
        return true;
      },
      update: async (data, expectedRev) => {
        if (!this.row || this.row.rev !== expectedRev) return false;
        this.row = { data: structuredClone(data), rev: expectedRev + 1 };
        return true;
      },
    };
  }
}

/** A device: its own app state and sync cursor, talking to a shared cloud. */
class Device {
  state: AppState = initialState();
  cursor: { rev: number; pushed: string } | null = null;
  constructor(private cloud: FakeCloud) {}
  do(...actions: Action[]) {
    for (const a of actions) this.state = reducer(this.state, a);
    return this;
  }
  sync() {
    return syncOnce({
      remote: this.cloud.store(),
      getState: () => this.state,
      applyRemote: (remote: Partial<SyncedData>) => (this.state = reducer(this.state, { type: "mergeRemote", remote })),
      loadCursor: () => this.cursor,
      saveCursor: (c) => (this.cursor = c),
    });
  }
}

/** Log a finished workout with one completed set. */
const logWorkout = (d: Device, exerciseId: string, weight: number, now: number) => {
  d.do({ type: "startWorkout", now }, { type: "addExerciseToWorkout", exerciseId });
  const we = d.state.active!.exercises[0];
  d.do(
    { type: "updateSet", workoutExerciseId: we.id, setId: we.sets[0].id, patch: { weight, reps: 5, done: true } },
    { type: "finishWorkout", now: now + 1000 }
  );
  return d.state.workouts[0].id;
};

describe("cloud sync", () => {
  it("uploads on first sync and downloads on a new device", async () => {
    const cloud = new FakeCloud();
    const phone = new Device(cloud);
    logWorkout(phone, "bench", 80, 1);
    expect(await phone.sync()).toBe("uploaded");

    const laptop = new Device(cloud);
    await laptop.sync();
    expect(laptop.state.workouts).toHaveLength(1);
    expect(laptop.state.workouts[0].exercises[0].sets[0].weight).toBe(80);
  });

  it("combines workouts logged offline on two devices", async () => {
    const cloud = new FakeCloud();
    const a = new Device(cloud), b = new Device(cloud);
    await a.sync(); await b.sync();
    logWorkout(a, "bench", 80, 1000);
    logWorkout(b, "squat", 120, 2000);
    await a.sync(); await b.sync(); await a.sync();
    expect(a.state.workouts.map((w) => w.exercises[0].exerciseId)).toEqual(["squat", "bench"]);
    expect(b.state.workouts).toEqual(a.state.workouts);
    expect(await a.sync()).toBe("unchanged");
  });

  it("carries deletions across devices instead of bringing items back", async () => {
    const cloud = new FakeCloud();
    const a = new Device(cloud), b = new Device(cloud);
    const id = logWorkout(a, "bench", 80, 1);
    await a.sync(); await b.sync();
    b.do({ type: "deleteWorkout", id });
    await b.sync(); await a.sync();
    expect(a.state.workouts).toHaveLength(0);
    expect(cloud.row!.data.workouts).toHaveLength(0);
  });

  it("lets a later re-add win over an earlier delete", async () => {
    const cloud = new FakeCloud();
    const a = new Device(cloud), b = new Device(cloud);
    a.do({ type: "trackPR", exerciseId: "bench" });
    await a.sync(); await b.sync();
    a.do({ type: "untrackPR", exerciseId: "bench" });
    await a.sync(); await b.sync();
    expect(b.state.trackedPRs).toHaveLength(0);
    await new Promise((r) => setTimeout(r, 2));
    b.do({ type: "trackPR", exerciseId: "bench" });
    await b.sync(); await a.sync();
    expect(a.state.trackedPRs.map((t) => t.exerciseId)).toEqual(["bench"]);
  });

  it("retries when another device writes in between", async () => {
    const cloud = new FakeCloud();
    const a = new Device(cloud), b = new Device(cloud);
    await a.sync(); await b.sync();
    logWorkout(a, "bench", 80, 1);
    logWorkout(b, "squat", 100, 2);
    // b writes right after a fetched: a's first update fails its revision check.
    const store = cloud.store();
    const realFetch = store.fetch;
    let first = true;
    const racing: RemoteStore = {
      ...store,
      fetch: async () => {
        const row = await realFetch();
        if (first) { first = false; await b.sync(); }
        return row;
      },
    };
    await syncOnce({
      remote: racing, getState: () => a.state,
      applyRemote: (remote) => (a.state = reducer(a.state, { type: "mergeRemote", remote })),
      loadCursor: () => a.cursor, saveCursor: (c) => (a.cursor = c),
    });
    expect(cloud.row!.data.workouts).toHaveLength(2);
    expect(a.state.workouts).toHaveLength(2);
  });

  it("does not sync the in-progress workout and keeps it through a merge", async () => {
    const cloud = new FakeCloud();
    const a = new Device(cloud);
    a.do({ type: "startWorkout" });
    await a.sync();
    expect(cloud.row!.data).not.toHaveProperty("active");
    const merged = mergeStates(a.state, cloud.row!.data);
    expect(merged.active).toEqual(a.state.active);
  });

  it("import replaces data even when merged with the cloud copy", async () => {
    const cloud = new FakeCloud();
    const a = new Device(cloud);
    logWorkout(a, "bench", 80, 1);
    await a.sync();
    a.do({ type: "importState", state: { ...initialState(), workouts: [] } });
    await a.sync();
    expect(a.state.workouts).toHaveLength(0);
    expect(cloud.row!.data.workouts).toHaveLength(0);
  });
});
