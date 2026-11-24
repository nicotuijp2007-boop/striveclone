import { useState, type ReactNode } from "react";
import { useApp } from "../context";
import type { SleepEntry } from "../types";
import { addDays, entryForDate,formatDuration, localDate, localTime, minutesBetween, nightFromInputs, validateNight } from "../lib/sleep";

export const MoonIcon = ({ size = 20 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

/** Defaults for a new night: the times of the latest entry, else 23:00 → 07:30. */
const defaultTimes = (entries: SleepEntry[]) => {
  const last = entries[0];
  return last ? { bed: localTime(last.bedAt), wake: localTime(last.wakeAt) } : { bed: "23:00", wake: "07:30" };
};

/**
 * Bedtime and wake-up with native time pickers, a live "time in bed" and validation. Used for the
 * morning check-in, adding a past night and editing one. `showDate` adds the wake-up date picker.
 */
export function SleepForm({ entry, date: fixedDate, showDate = true, saveLabel = "Save sleep", onDone, secondary }: {
  entry?: SleepEntry;
  date?: string;
  showDate?: boolean;
  saveLabel?: string;
  onDone: () => void;
  /** Second button next to Save (Cancel or Skip). */
  secondary: ReactNode;
}) {
  const { state, dispatch } = useApp();
  const defaults = defaultTimes(state.sleep);
  // Before this morning's usual wake-up (e.g. logging at 01:00), the latest night ended yesterday.
  const [date, setDate] = useState(() => {
    if (entry) return entry.date;
    if (fixedDate) return fixedDate;
    const today = localDate(Date.now());
    return localTime(Date.now()) < defaults.wake ? addDays(today, -1) : today;
  });
  const [bed, setBed] = useState(entry ? localTime(entry.bedAt) : defaults.bed);
  const [wake, setWake] = useState(entry ? localTime(entry.wakeAt) : defaults.wake);

  const night = nightFromInputs(date, bed, wake);
  const error = validateNight(night?.bedAt, night?.wakeAt)
    ?? (entryForDate(state.sleep, date, entry?.id) ? "This night is already logged. Edit that entry in the history instead." : null);
  const minutes = night && !error ? minutesBetween(night.bedAt, night.wakeAt) : null;

  const save = () => {
    if (error || !night) return;
    dispatch({ type: "saveSleep", id: entry?.id, ...night });
    onDone();
  };

  return (
    <div className="sleep-form">
      {showDate && (
        <label className="sleep-field">
          <span>Morning of</span>
          <input className="input" type="date" value={date} max={localDate(Date.now())} onChange={(e) => setDate(e.target.value)} />
        </label>
      )}
      <div className="sleep-times">
        <label className="sleep-field">
          <span>Went to bed</span>
          <input className="input sleep-time" type="time" value={bed} onChange={(e) => setBed(e.target.value)} />
        </label>
        <label className="sleep-field">
          <span>Woke up</span>
          <input className="input sleep-time" type="time" value={wake} onChange={(e) => setWake(e.target.value)} />
        </label>
      </div>
      <div className="sleep-live" aria-live="polite">
        <span className="sleep-label">Time in bed</span>
        <strong>{minutes !== null ? formatDuration(minutes) : "–"}</strong>
      </div>
      {error && <p className="sleep-error" role="alert">{error}</p>}
      <div className="row">
        {secondary}
        <button className="btn primary grow" onClick={save} disabled={!!error}>{saveLabel}</button>
      </div>
    </div>
  );
}

/** The non-intrusive morning card on Home. */
export function SleepCheckIn() {
  const { dispatch } = useApp();
  const today = localDate(Date.now());
  return (
    <div className="card sleep-card">
      <div className="sleep-greet"><MoonIcon /> <span>Good morning!</span></div>
      <div>
        <h3>How did you sleep?</h3>
        <p className="muted small">Log last night to keep track of your recovery.</p>
      </div>
      <SleepForm date={today} showDate={false} onDone={() => {}}
        secondary={<button className="btn ghost" onClick={() => dispatch({ type: "skipSleepCheckIn", date: today })}>Skip</button>} />
    </div>
  );
}
