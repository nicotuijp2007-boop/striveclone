import { useEffect } from "react";
import type { CustomTheme, ThemeMode } from "../types";
import { customThemeVars } from "./theme";

const CUSTOM_VARS = Object.keys(customThemeVars({ base: "dark", accent: "#000000", bg: "#000000", surface: "#000000" }));

/**
 * Set data-theme on <html> (removed for "system", so prefers-color-scheme decides). A custom theme
 * uses its base as data-theme plus inline variables. The browser's theme colour follows --bg.
 * index.html does the same before the app loads, to avoid a flash.
 */
export function useTheme(mode: ThemeMode, custom: CustomTheme): void {
  const { base, accent, bg, surface } = custom;
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia?.("(prefers-color-scheme: light)");
    const apply = () => {
      for (const v of CUSTOM_VARS) root.style.removeProperty(v);
      if (mode === "system") delete root.dataset.theme;
      else if (mode === "custom") {
        root.dataset.theme = base;
        for (const [k, v] of Object.entries(customThemeVars({ base, accent, bg, surface }))) root.style.setProperty(k, v);
      } else root.dataset.theme = mode;
      const color = getComputedStyle(root).getPropertyValue("--bg").trim();
      if (color) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);
    };
    apply();
    media?.addEventListener?.("change", apply);
    return () => media?.removeEventListener?.("change", apply);
  }, [mode, base, accent, bg, surface]);
}

/**
 * Keep the screen on while `on` is true. The browser drops the lock when the app goes to the
 * background, so it is taken again on return. Does nothing where the Wake Lock API is missing.
 */
export function useWakeLock(on: boolean): void {
  useEffect(() => {
    if (!on || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;
    const acquire = async () => {
      if (document.visibilityState !== "visible" || (lock && !lock.released)) return;
      try {
        const l = await navigator.wakeLock.request("screen");
        if (stopped) void l.release();
        else lock = l;
      } catch {
        /* refused (e.g. battery saver); try again next time the app is shown */
      }
    };
    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release().catch(() => {});
    };
  }, [on]);
}
