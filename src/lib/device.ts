import { useEffect } from "react";
import type { ThemeMode } from "../types";

const THEME_COLORS = { dark: "#0f1115", light: "#f4f5f7" };

/**
 * Set data-theme on <html> ("light" or "dark"; removed for "system", so prefers-color-scheme decides)
 * and match the browser's theme colour. index.html does the same before the app loads, to avoid a flash.
 */
export function useTheme(mode: ThemeMode): void {
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia?.("(prefers-color-scheme: light)");
    const apply = () => {
      if (mode === "system") delete root.dataset.theme;
      else root.dataset.theme = mode;
      const effective = mode === "system" ? (media?.matches ? "light" : "dark") : mode;
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[effective]);
    };
    apply();
    media?.addEventListener?.("change", apply);
    return () => media?.removeEventListener?.("change", apply);
  }, [mode]);
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
