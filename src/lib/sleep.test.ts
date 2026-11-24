import { describe, expect, it, vi } from "vitest";
import { initialState, loadState, reducer, STORAGE_KEY } from "../store";
import { mergeStates, toSynced } from "../sync/merge";
import { normalizeSettings } from "./settings";
import {
  addDays, averageMinutes, combine, dedupeByNight, formatDuration, lastNights, minutesBetween,
  nightFromInputs, shouldShowCheckIn, sleepByDate, validateNight,
} from "./sleep";
import type { AppState, SleepEntry } from "../types";

const at = (date: string, time: string) => combine(date, time)!;
const NOW = at("2026-11-24", "09:00");

const logged = (s: AppState, wakeDate: string, bed = "23:00", wake = "07:30", now = NOW) =>
  reducer(s, { type: "saveSleep", ...nightFromInputs(wakeDate, bed, wake)!, now });

const entry = (p: Partial<SleepEntry> & { id: string; date: string }): SleepEntry => ({
  bedAt: at(addDays(p.date, -1), "23:00"), wakeAt: at(p.date, "07:00"), minutes: 480, createdAt: 1, updatedAt: 1, ...p,
});

describe("time in bed", () => {
  it("crosses midnight: 23:00 → 07:30 is 8h 30m", () => {
    const n = nightFromInputs("2026-11-24", "23:00", "07:30")!;
    expect(n.bedAt).toBe(at("2026-11-23", "23:00"));
    expect(minutesBetween(n.bedAt, n.wakeAt)).toBe(510);
    expect(formatDuration(510)).toBe("8h 30m");
  });

  it("keeps a bedtime after midnight on the same date", () => {
    const n = nightFromInputs("2026-11-24", "01:15", "07:00")!;
    expect(n.bedAt).toBe(at("2026-11-24", "01:15"));
    expect(minutesBetween(n.bedAt, n.wakeAt)).toBe(345);
  });

  it("handles different calendar dates across a month and year end", () => {
    const n = nightFromInputs("2027-01-01", "22:30", "06:30")!;
    expect(n.bedAt).toBe(at("2026-12-31", "22:30"));
    expect(minutesBetween(n.bedAt, n.wakeAt)).toBe(480);
  });

  it("formats short and whole durations", () => {
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(540)).toBe("9h");
  });

  it("returns null for missing or malformed values", () => {
    expect(nightFromInputs("2026-11-24", "", "07:00")).toBeNull();
    expect(nightFromInputs("", "23:00", "07:00")).toBeNull();
    expect(validateNight(null, NOW)).toMatch(/both/);
    expect(validateNight(NaN, NOW)).toMatch(/both/);
  });

  it("rejects wake-up before bedtime, more than 20 hours, and the future", () => {
    expect(validateNight(at("2026-11-24", "08:00"), at("2026-11-24", "07:00"), NOW)).toMatch(/after bedtime/);
    expect(validateNight(at("2026-11-22", "08:00"), at("2026-11-23", "07:00"), NOW)).toMatch(/20 hours/);
    expect(validateNight(at("2026-11-24", "08:00"), at("2026-11-24", "10:00"), NOW)).toMatch(/future/);
    expect(validateNight(at("2026-11-23", "23:00"), at("2026-11-24", "07:30"), NOW)).toBeNull();
  });
});

describe("sleep entries in the store", () => {
  it("logs a night with full timestamps, minutes and dates", () => {
    const s = logged(initialState(), "2026-11-24");
    expect(s.sleep).toHaveLength(1);
    expect(s.sleep[0]).toMatchObject({ date: "2026-11-24", minutes: 510, createdAt: NOW, updatedAt: NOW });
    expect(sleepByDate(s.sleep).get("2026-11-24")?.minutes).toBe(510);
  });

  it("refuses invalid nights", () => {
    const s = reducer(initialState(), { type: "saveSleep", bedAt: at("2026-11-24", "08:00"), wakeAt: at("2026-11-24", "07:00"), now: NOW });
    expect(s.sleep).toHaveLength(0);
  });

  it("prevents a second entry for the same night", () => {
    const s = logged(logged(initialState(), "2026-11-24"), "2026-11-24", "22:00", "06:00");
    expect(s.sleep).toHaveLength(1);
    expect(s.sleep[0].minutes).toBe(510);
  });

  it("edits a night, keeping id and createdAt", () => {
    const s1 = logged(initialState(), "2026-11-24");
    const id = s1.sleep[0].id;
    const later = NOW + 60000;
    const s2 = reducer(s1, { type: "saveSleep", id, ...nightFromInputs("2026-11-24", "22:00", "07:00")!, now: later });
    expect(s2.sleep).toHaveLength(1);
    expect(s2.sleep[0]).toMatchObject({ id, minutes: 540, createdAt: NOW, updatedAt: later });
  });

  it("can't move an edit onto a night that already has an entry", () => {
    const s = logged(logged(initialState(), "2026-11-24"), "2026-11-23");
    const older = s.sleep.find((e) => e.date === "2026-11-23")!;
    const s2 = reducer(s, { type: "saveSleep", id: older.id, ...nightFromInputs("2026-11-24", "23:00", "07:00")!, now: NOW });
    expect(s2).toBe(s);
  });

  it("deletes with a tombstone, and clearSleep removes everything", () => {
    const s = logged(logged(initialState(), "2026-11-24"), "2026-11-23");
    const id = s.sleep[0].id;
    const d = reducer(s, { type: "deleteSleep", id });
    expect(d.sleep).toHaveLength(1);
    expect(d.deleted[`sleep:${id}`]).toBeGreaterThan(0);
    const c = reducer(s, { type: "clearSleep" });
    expect(c.sleep).toHaveLength(0);
    expect(Object.keys(c.deleted).filter((k) => k.startsWith("sleep:"))).toHaveLength(2);
  });

  it("averages the last 7 and 30 nights, and lists the week with gaps", () => {
    let s = initialState();
    s = logged(s, "2026-11-24", "23:00", "07:00"); // 8h
    s = logged(s, "2026-11-22", "00:00", "06:00"); // 6h
    s = logged(s, "2026-11-01", "22:00", "08:00"); // 10h, outside 7 days
    expect(averageMinutes(s.sleep, 7, "2026-11-24")).toBe(420);
    expect(averageMinutes(s.sleep, 30, "2026-11-24")).toBe(480);
    expect(averageMinutes([], 7, "2026-11-24")).toBeNull();
    const week = lastNights(s.sleep, 7, "2026-11-24");
    expect(week.map((n) => n.minutes)).toEqual([null, null, null, null, 360, null, 480]);
    expect(week[0].date).toBe("2026-11-18");
  });
});

describe("enabled and disabled", () => {
  it("is off by default, also for older settings without the field", () => {
    expect(initialState().settings.sleepTracking).toBe(false);
    expect(normalizeSettings({ restSeconds: 60 }).sleepTracking).toBe(false);
  });

  it("shows the check-in only when on, in the morning, and not yet logged or skipped", () => {
    const off = initialState();
    expect(shouldShowCheckIn(off, NOW)).toBe(false);
    const on = reducer(off, { type: "updateSettings", patch: { sleepTracking: true } });
    expect(shouldShowCheckIn(on, NOW)).toBe(true);
    expect(shouldShowCheckIn(on, at("2026-11-24", "15:00"))).toBe(false);
    expect(shouldShowCheckIn(on, at("2026-11-24", "03:00"))).toBe(false);
    expect(shouldShowCheckIn(logged(on, "2026-11-24"), NOW)).toBe(false);
    expect(shouldShowCheckIn(reducer(on, { type: "skipSleepCheckIn", date: "2026-11-24" }), NOW)).toBe(false);
    // The next morning it's back.
    expect(shouldShowCheckIn(reducer(on, { type: "skipSleepCheckIn", date: "2026-11-24" }), NOW + 864e5)).toBe(true);
  });

  it("keeps sleep data when tracking is turned off and on again", () => {
    const on = logged(reducer(initialState(), { type: "updateSettings", patch: { sleepTracking: true } }), "2026-11-24");
    const off = reducer(on, { type: "updateSettings", patch: { sleepTracking: false } });
    expect(off.sleep).toHaveLength(1);
    expect(reducer(off, { type: "updateSettings", patch: { sleepTracking: true } }).sleep).toEqual(on.sleep);
  });
});

describe("sync", () => {
  it("merges nights from two devices by id", () => {
    const a = logged(initialState(), "2026-11-24");
    const b = logged(initialState(), "2026-11-23");
    const m = mergeStates(a, toSynced(b));
    expect(m.sleep.map((e) => e.date)).toEqual(["2026-11-24", "2026-11-23"]);
  });

  it("keeps the newest edit", () => {
    const a = logged(initialState(), "2026-11-24");
    const id = a.sleep[0].id;
    const b = reducer(a, { type: "saveSleep", id, ...nightFromInputs("2026-11-24", "22:00", "07:00")!, now: NOW + 1000 });
    expect(mergeStates(a, toSynced(b)).sleep[0].minutes).toBe(540);
    expect(mergeStates(b, toSynced(a)).sleep[0].minutes).toBe(540);
  });

  it("a delete on one device removes the night on the other", () => {
    const a = logged(initialState(), "2026-11-24");
    const b = reducer(a, { type: "deleteSleep", id: a.sleep[0].id });
    expect(mergeStates(a, toSynced(b)).sleep).toHaveLength(0);
    expect(mergeStates(b, toSynced(a)).sleep).toHaveLength(0);
  });

  it("two devices logging the same night end up with one entry, the same on both", () => {
    const a = logged(initialState(), "2026-11-24", "23:00", "07:30", NOW);
    const b = logged(initialState(), "2026-11-24", "22:00", "07:00", NOW + 5);
    const onA = mergeStates(a, toSynced(b)).sleep;
    const onB = mergeStates(b, toSynced(a)).sleep;
    expect(onA).toHaveLength(1);
    expect(onA).toEqual(onB);
    expect(onA[0].minutes).toBe(540);
    expect(dedupeByNight([entry({ id: "a", date: "2026-11-24" }), entry({ id: "b", date: "2026-11-24" })])[0].id).toBe("b");
  });

  it("merges skipped mornings", () => {
    const a = reducer(initialState(), { type: "skipSleepCheckIn", date: "2026-11-23" });
    const b = reducer(initialState(), { type: "skipSleepCheckIn", date: "2026-11-24" });
    expect(mergeStates(a, toSynced(b)).sleepSkips).toEqual(["2026-11-23", "2026-11-24"]);
  });

  it("older data without sleep fields loads and syncs without crashing", () => {
    const { sleep: _s, sleepSkips: _k, ...old } = toSynced(initialState());
    const oldSettings = { ...old.settings } as Partial<AppState["settings"]>;
    delete oldSettings.sleepTracking;
    const remote = { ...old, settings: { ...oldSettings, updatedAt: NOW } } as never;
    const local = logged(initialState(), "2026-11-24");
    const m = mergeStates(local, remote);
    expect(m.sleep).toHaveLength(1);
    expect(m.sleepSkips).toEqual([]);
    expect(m.settings.sleepTracking).toBe(false);

    // Tests run in Node without a real localStorage, so stub the one read loadState does.
    const saved = JSON.stringify({ ...old, settings: oldSettings, active: null });
    vi.stubGlobal("localStorage", { getItem: (k: string) => (k === STORAGE_KEY ? saved : null) });
    const loaded = loadState();
    vi.unstubAllGlobals();
    expect(loaded.sleep).toEqual([]);
    expect(loaded.sleepSkips).toEqual([]);
    expect(loaded.settings.sleepTracking).toBe(false);
  });
});
