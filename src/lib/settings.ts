import type { Settings } from "../types";

export const defaultSettings = (): Settings => ({
  restEnabled: true,
  restSeconds: 90,
  autoRest: true,
  restSound: true,
  restVibrate: true,
  theme: "system",
  keepAwake: true,
  weightStep: 2.5,
  prefillSets: true,
  dashboard: { order: [], hidden: [], months: 3 },
  updatedAt: 0,
});

/** Fill in settings missing from older saved data (or another device on an older version). */
export const normalizeSettings = (s: Partial<Settings> | undefined): Settings => {
  const base = defaultSettings();
  return { ...base, ...s, dashboard: { ...base.dashboard, ...s?.dashboard } };
};
