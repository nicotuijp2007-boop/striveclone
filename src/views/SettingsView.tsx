import { useRef, type CSSProperties, type ReactNode } from "react";
import { useApp } from "../context";
import { AccountSection } from "../components/AccountSection";
import { formatClock } from "../lib/audio";
import { exportBackup, readBackup } from "../lib/backup";
import { customWarnings, defaultCustomTheme } from "../lib/theme";
import type { CustomTheme, Settings, ThemeMode } from "../types";

const DURATIONS = [30, 60, 90, 120, 180];
const THEMES: { id: ThemeMode; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "midnight", label: "Midnight" },
  { id: "forest", label: "Forest" },
  { id: "sand", label: "Sand" },
  { id: "custom", label: "Custom" },
];
const BASES: { id: CustomTheme["base"]; label: string }[] = [
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
];
const COLOR_FIELDS: { key: "accent" | "bg" | "surface"; label: string }[] = [
  { key: "accent", label: "Accent" },
  { key: "bg", label: "Background" },
  { key: "surface", label: "Cards" },
];

const canVibrate = typeof navigator !== "undefined" && "vibrate" in navigator;
const canWakeLock = typeof navigator !== "undefined" && "wakeLock" in navigator;

export function SettingsView({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useApp();
  const s = state.settings;
  const set = (patch: Partial<Omit<Settings, "updatedAt">>) => dispatch({ type: "updateSettings", patch });
  const fileRef = useRef<HTMLInputElement>(null);

  const importFile = async (file: File) => {
    try {
      const data = await readBackup(file);
      if (confirm("Replace all current data with this backup?")) dispatch({ type: "importState", state: data });
    } catch {
      alert("That file is not a valid Liftlog backup.");
    }
  };

  return (
    <section className="stack settings">
      <div className="section-head">
        <h2>Settings</h2>
        <button className="btn ghost sm" onClick={onClose}>Done</button>
      </div>

      <Group title="Account & sync">
        <AccountSection />
      </Group>

      <Group title="Rest timer">
        <Switch label="Rest timer" checked={s.restEnabled} onChange={(v) => set({ restEnabled: v })}
          hint={s.restEnabled ? undefined : "Off: no rest bar and no rest button during a workout."} />
        {s.restEnabled && (
          <>
            <div className="setting-block">
              <span>Length</span>
              <div className="chips" role="radiogroup" aria-label="Rest length">
                {DURATIONS.map((d) => (
                  <button key={d} role="radio" aria-checked={s.restSeconds === d} className={`chip ${s.restSeconds === d ? "on" : ""}`}
                    onClick={() => set({ restSeconds: d })}>{formatClock(d)}</button>
                ))}
              </div>
            </div>
            <Switch label="Start automatically after a set" checked={s.autoRest} onChange={(v) => set({ autoRest: v })} />
            <Switch label="Sound when rest ends" checked={s.restSound} onChange={(v) => set({ restSound: v })} />
            <Switch label="Vibrate when rest ends" checked={s.restVibrate} onChange={(v) => set({ restVibrate: v })}
              hint={canVibrate ? undefined : "This browser can't vibrate (iPhone doesn't allow it)."} />
          </>
        )}
      </Group>

      <Group title="Appearance">
        <ThemePicker value={s.theme} custom={s.customTheme} onChange={(theme) => set({ theme })} />
        {s.theme === "custom" && <CustomThemeEditor value={s.customTheme} onChange={(customTheme) => set({ customTheme })} />}
      </Group>

      <Group title="Workout">
        <Switch label="Keep screen on during a workout" checked={s.keepAwake} onChange={(v) => set({ keepAwake: v })}
          hint={canWakeLock ? undefined : "Not supported in this browser, so this has no effect here."} />
        <Switch label="Fill in sets from last time" checked={s.prefillSets} onChange={(v) => set({ prefillSets: v })}
          hint={s.prefillSets ? "New sets use the recommended weight (you fill in the reps), or last time's weight and reps." : "New exercises start with an empty set; the advice card still shows the target."} />
      </Group>

      <Group title="Sleep tracking">
        <Switch label="Track sleep" checked={s.sleepTracking} onChange={(v) => set({ sleepTracking: v })}
          hint={s.sleepTracking
            ? "Each morning Home asks how you slept. The Time in bed tile (hide or move it with Edit on Home) opens your history. Turn off any time; your sleep history stays saved."
            : "Optional. Adds a short morning check-in and a Time in bed tile to your Home dashboard."} />
        {state.sleep.length > 0 && (
          <div className="split">
            <span className="muted small">{state.sleep.length} {state.sleep.length === 1 ? "night" : "nights"} saved</span>
            <button className="btn ghost sm danger" onClick={() => {
              if (confirm("Delete all sleep data? This can't be undone.")) dispatch({ type: "clearSleep" });
            }}>Delete sleep data</button>
          </div>
        )}
      </Group>

      <Group title="Backup">
        <p className="muted small">
          Save all your data as a file, or restore it from one. Importing replaces everything currently in the app.
        </p>
        <div className="row">
          <button className="btn secondary grow" onClick={() => exportBackup(state)}>Export</button>
          <button className="btn secondary grow" onClick={() => fileRef.current?.click()}>Import</button>
          <input ref={fileRef} type="file" accept="application/json" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ""; }} />
        </div>
      </Group>
    </section>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card setting-group">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function Switch({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="setting-row">
      <span className="setting-text">
        <span>{label}</span>
        {hint && <span className="muted small">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

/** Theme swatches. Each card carries data-theme, so it renders with that theme's own tokens. */
function ThemePicker({ value, custom, onChange }: { value: ThemeMode; custom: CustomTheme; onChange: (t: ThemeMode) => void }) {
  return (
    <div className="setting-block">
      <span>Theme</span>
      <div className="theme-grid" role="radiogroup" aria-label="Theme">
        {THEMES.map((t) => {
          const swatch =
            t.id === "custom"
              ? { "data-theme": custom.base, style: { "--bg": custom.bg, "--surface": custom.surface, "--accent": custom.accent } as CSSProperties }
              : t.id === "system" ? {} : { "data-theme": t.id };
          return (
            <button key={t.id} role="radio" aria-checked={value === t.id} className={`theme-card${value === t.id ? " on" : ""}`} onClick={() => onChange(t.id)}>
              {t.id === "system" ? (
                <span className="theme-swatch split-swatch">
                  <span data-theme="light"><i /><b /></span>
                  <span data-theme="dark"><i /><b /></span>
                </span>
              ) : (
                <span className="theme-swatch" {...swatch}><i /><b /></span>
              )}
              <span className="theme-name">{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Base and key colours of the custom theme. The whole app updates as you pick, so it is its own preview. */
function CustomThemeEditor({ value, onChange }: { value: CustomTheme; onChange: (c: CustomTheme) => void }) {
  const warnings = customWarnings(value);
  return (
    <div className="custom-theme">
      {/* Switching base starts from that base's colours, since dark colours don't work on a light base. */}
      <Segmented label="Base" options={BASES} value={value.base} onChange={(base) => base !== value.base && onChange(defaultCustomTheme(base))} />
      {COLOR_FIELDS.map((f) => (
        <label key={f.key} className="setting-row">
          <span>{f.label}</span>
          <span className="row">
            <code className="muted small">{value[f.key]}</code>
            <input type="color" className="color-input" value={value[f.key]} onChange={(e) => onChange({ ...value, [f.key]: e.target.value.toLowerCase() })} />
          </span>
        </label>
      ))}
      <div className="theme-preview" aria-label="Preview">
        <div className="split">
          <span>
            <strong>Bench press</strong>
            <span className="muted small"> · 3 × 8 · 80 kg</span>
          </span>
          <span className="pill">PR</span>
        </div>
        <div className="row">
          <span className="theme-preview-chip">Set 1</span>
          <span className="theme-preview-chip">Set 2</span>
          <button className="btn primary grow" type="button" tabIndex={-1}>Finish</button>
        </div>
      </div>
      {warnings.map((w) => (
        <p key={w} className="theme-warning small" role="status">{w}</p>
      ))}
      <button className="btn" onClick={() => onChange(defaultCustomTheme(value.base))}>Reset colours</button>
    </div>
  );
}

function Segmented<T extends string | number>({ label, options, value, onChange }: {
  label: string; options: { id: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="setting-block">
      <span>{label}</span>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o.id} role="radio" aria-checked={value === o.id} className={value === o.id ? "on" : ""} onClick={() => onChange(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
