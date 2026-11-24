import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeSettings } from "./settings";
import {
  contrastRatio, customThemeVars, customWarnings, defaultCustomTheme, inkFor, isHex, mixHex, normalizeCustomTheme,
} from "./theme";

describe("colour helpers", () => {
  it("accepts only #rrggbb", () => {
    expect(isHex("#a1B2c3")).toBe(true);
    for (const bad of ["red", "#fff", "#12345g", "123456", "#1234567", 42, undefined]) expect(isHex(bad)).toBe(false);
  });

  it("mixes like color-mix in srgb", () => {
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mixHex("#102030", "#ffffff", 0)).toBe("#102030");
    expect(mixHex("#102030", "#ffffff", 1)).toBe("#ffffff");
  });

  it("computes WCAG contrast", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#777777")).toBe(1);
  });

  it("picks dark ink on a bright accent and white on a dark one", () => {
    expect(inkFor("#c6f432")).toBe("#000000");
    expect(inkFor("#0d6e66")).toBe("#ffffff");
  });

  it("keeps accent ink readable for any accent", () => {
    // Pseudo-random but fixed, so the test is stable.
    let seed = 7;
    for (let i = 0; i < 500; i++) {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      const accent = "#" + (seed % 0x1000000).toString(16).padStart(6, "0");
      const vars = customThemeVars({ ...defaultCustomTheme(), accent });
      // The worst case (a mid grey) still gets ~4.6:1 with black or white ink.
      expect(contrastRatio(accent, vars["--accent-ink"])).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("derives surface steps between the card colour and the text colour", () => {
    const vars = customThemeVars(defaultCustomTheme("dark"));
    expect(vars["--surface"]).toBe("#15171c");
    expect(contrastRatio(vars["--surface-2"], "#000000")).toBeGreaterThan(contrastRatio(vars["--surface"], "#000000"));
    expect(contrastRatio(vars["--surface-3"], "#000000")).toBeGreaterThan(contrastRatio(vars["--surface-2"], "#000000"));
  });
});

describe("custom theme warnings", () => {
  it("has none for the defaults", () => {
    expect(customWarnings(defaultCustomTheme("dark"))).toEqual([]);
    expect(customWarnings(defaultCustomTheme("light"))).toEqual([]);
  });

  it("warns about a light background on a dark base and a faint accent", () => {
    const w = customWarnings({ base: "dark", bg: "#eeeeee", surface: "#15171c", accent: "#e0e0e0" });
    expect(w.some((m) => m.includes("background"))).toBe(true);
    expect(w.some((m) => m.includes("accent"))).toBe(true);
  });
});

describe("theme settings normalization", () => {
  it("loads old settings without the new fields", () => {
    const s = normalizeSettings({ theme: "dark", restSeconds: 60 });
    expect(s.theme).toBe("dark");
    expect(s.customTheme).toEqual(defaultCustomTheme("dark"));
  });

  it("falls back to System for an unknown theme", () => {
    expect(normalizeSettings({ theme: "neon" as never }).theme).toBe("system");
    expect(normalizeSettings({ theme: "forest" }).theme).toBe("forest");
  });

  it("replaces invalid colours with the base's defaults and lower-cases valid ones", () => {
    const light = defaultCustomTheme("light");
    expect(normalizeCustomTheme({ base: "light", accent: "red", bg: "#fff", surface: "#12345g" })).toEqual(light);
    expect(normalizeCustomTheme({ base: "light", accent: "#AABBCC" })).toEqual({ ...light, accent: "#aabbcc" });
    expect(normalizeCustomTheme({ base: "pink" as never }).base).toBe("dark");
  });
});

describe("preset themes in styles.css", () => {
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const presets = [...css.matchAll(/\[data-theme="(\w+)"\] \{([^}]*)\}/g)].map(([, name, body]) => ({
    name,
    t: Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map(([, k, v]) => [k, v])),
  }));

  it("finds every preset with the full token set", () => {
    expect(presets.map((p) => p.name)).toEqual(["dark", "light", "midnight", "forest", "sand"]);
    for (const { t } of presets) {
      for (const k of ["bg", "surface", "surface-2", "surface-3", "text", "muted", "accent", "accent-ink", "info", "warn", "danger", "sleep"]) {
        expect(t[k]).toMatch(/^#/);
      }
    }
  });

  it.each(["midnight", "forest", "sand", "dark", "light"])("%s keeps readable contrast", (name) => {
    const { t } = presets.find((p) => p.name === name)!;
    expect(contrastRatio(t.text, t.bg)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(t.text, t["surface-3"])).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(t.muted, t.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t["accent-ink"], t.accent)).toBeGreaterThanOrEqual(4.5);
    for (const k of ["accent", "info", "warn", "danger", "sleep"]) expect(contrastRatio(t[k], t.surface)).toBeGreaterThanOrEqual(3);
  });
});
