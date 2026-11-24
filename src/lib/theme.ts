import type { CustomTheme, ThemeMode } from "../types";

export const THEME_MODES: readonly ThemeMode[] = ["system", "light", "dark", "midnight", "forest", "sand", "custom"];

/** Text colour of each base theme (styles.css); custom themes keep it, so the derived tokens mix towards it. */
const BASE_TEXT = { dark: "#f2f4f7", light: "#14161b" } as const;

/** A custom theme starts as a copy of its base theme. */
export const defaultCustomTheme = (base: CustomTheme["base"] = "dark"): CustomTheme =>
  base === "light"
    ? { base, accent: "#4f7a00", bg: "#f3f4f6", surface: "#ffffff" }
    : { base, accent: "#c6f432", bg: "#0b0c0f", surface: "#15171c" };

export const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);

/** Keep valid fields and replace the rest with the defaults of the (valid) base. */
export function normalizeCustomTheme(c: Partial<CustomTheme> | undefined): CustomTheme {
  const base = c?.base === "light" ? "light" : "dark";
  const d = defaultCustomTheme(base);
  const pick = (v: unknown, fallback: string) => (isHex(v) ? v.toLowerCase() : fallback);
  return { base, accent: pick(c?.accent, d.accent), bg: pick(c?.bg, d.bg), surface: pick(c?.surface, d.surface) };
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (rgb: number[]) => "#" + rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");

/** `amount` (0–1) of `b` mixed into `a`, like color-mix(in srgb, a, b amount). */
export function mixHex(a: string, b: string, amount: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return toHex(x.map((c, i) => c + (y[i] - c) * amount));
}

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 (none) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
}

// Pure black (not near-black), so even a mid-tone accent gets at least 4.5:1.
const DARK_INK = "#000000";
const LIGHT_INK = "#ffffff";

/** Text colour for on top of `accent` (buttons, chips): near-black or white, whichever reads better. */
export const inkFor = (accent: string): string =>
  contrastRatio(accent, DARK_INK) >= contrastRatio(accent, LIGHT_INK) ? DARK_INK : LIGHT_INK;

/**
 * All CSS variables a custom theme overrides on top of its base. Mixed here rather than with
 * CSS color-mix, so the contrast checks see the real colours.
 */
export function customThemeVars(c: CustomTheme): Record<string, string> {
  const text = BASE_TEXT[c.base];
  return {
    "--bg": c.bg,
    "--surface": c.surface,
    "--surface-2": mixHex(c.surface, text, 0.06),
    "--surface-3": mixHex(c.surface, text, 0.12),
    "--muted": mixHex(text, c.bg, 0.42),
    "--accent": c.accent,
    "--accent-ink": inkFor(c.accent),
  };
}

/** Readability problems of a custom theme, as short hints for Settings. */
export function customWarnings(c: CustomTheme): string[] {
  const text = BASE_TEXT[c.base];
  const out: string[] = [];
  const other = c.base === "dark" ? "darker" : "lighter";
  if (contrastRatio(text, c.bg) < 4.5) out.push(`Text is hard to read on this background. Pick a ${other} background or switch the base.`);
  if (contrastRatio(text, c.surface) < 4.5) out.push(`Text is hard to read on these cards. Pick a ${other} card colour.`);
  if (contrastRatio(c.accent, c.bg) < 3) out.push("The accent barely stands out from the background.");
  return out;
}
