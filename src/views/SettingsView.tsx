import { useRef, type ReactNode } from "react";
import { useApp } from "../context";
import { AccountSection } from "../components/AccountSection";
import { formatClock } from "../lib/audio";
import { exportBackup, readBackup } from "../lib/backup";
import type { Settings, ThemeMode } from "../types";

const DURATIONS = [30, 60, 90, 120, 180];
const THEMES: { id: ThemeMode; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
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
        <Segmented label="Theme" options={THEMES} value={s.theme} onChange={(theme) => set({ theme })} />
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
