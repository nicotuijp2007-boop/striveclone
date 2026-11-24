import type { Settings } from "../types";

export const defaultSettings = (): Settings => ({
  restEnabled: true,
  restSeconds: 90,
  autoRest: true,
  restSound: true,
  restVibrate: true,
  theme: "system",
  keepAwake: true,
  prefillSets: true,
  dashboard: { order: [], hidden: [], months: 3 },
  sleepTracking: false,
  updatedAt: 0,
});

/** Fill in settings missing from older saved data (or another device on an older version). */
export const normalizeSettings = (s: Partial<Settings> | undefined): Settings => {
  const base = defaultSettings();
  // Keep only settings this version knows, so retired or future fields (e.g. weightStep) are ignored.
  const known = Object.fromEntries(Object.entries(s ?? {}).filter(([k]) => k in base)) as Partial<Settings>;
  return { ...base, ...known, dashboard: { ...base.dashboard, ...known.dashboard } };
};
