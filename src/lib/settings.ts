import type { Settings } from "../types";
import { THEME_MODES, defaultCustomTheme, normalizeCustomTheme } from "./theme";

export const defaultSettings = (): Settings => ({
  restEnabled: true,
  restSeconds: 90,
  autoRest: true,
  restSound: true,
  restVibrate: true,
  theme: "system",
  customTheme: defaultCustomTheme(),
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
  return {
    ...base,
    ...known,
    // A theme from a newer version (or garbage) falls back to System.
    theme: THEME_MODES.includes(known.theme as Settings["theme"]) ? (known.theme as Settings["theme"]) : base.theme,
    customTheme: normalizeCustomTheme(known.customTheme),
    dashboard: { ...base.dashboard, ...known.dashboard },
  };
};
