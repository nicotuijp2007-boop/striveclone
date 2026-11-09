import { useRef } from "react";
import { useApp } from "../context";
import { durationMinutes, formatKg, workoutVolume } from "../lib/stats";
import type { AppState } from "../types";

export function HistoryView() {
  const { state, dispatch, exerciseById } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `liftlog-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importData = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as AppState;
      if (!Array.isArray(data.workouts) || !Array.isArray(data.exercises)) throw new Error("bad file");
      if (confirm("Replace all current data with this backup?")) dispatch({ type: "importState", state: data });
    } catch {
      alert("That file is not a valid Liftlog backup.");
    }
  };

  return (
    <section className="stack">
      <div className="section-head">
        <h2>History</h2>
        <div className="row tight">
          <button className="btn ghost sm" onClick={exportData}>Export</button>
          <button className="btn ghost sm" onClick={() => fileRef.current?.click()}>Import</button>
          <input ref={fileRef} type="file" accept="application/json" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void importData(f); e.target.value = ""; }} />
        </div>
      </div>
      {state.workouts.length === 0 && <p className="muted">Finished workouts show up here.</p>}
      {state.workouts.map((w) => (
        <details key={w.id} className="card history">
          <summary>
            <div>
              <strong>{w.name}</strong>
              <div className="muted small">
                {new Date(w.startedAt).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
              </div>
            </div>
            <div className="history-meta muted small">
              <span>{durationMinutes(w)} min</span>
              <span>{formatKg(workoutVolume(w))}</span>
            </div>
          </summary>
          <ul className="plain">
            {w.exercises.map((we) => (
              <li key={we.id}>
                <strong>{exerciseById(we.exerciseId)?.name ?? "?"}</strong>
                <div className="muted small">{we.sets.map((s) => `${s.weight} kg × ${s.reps}`).join(", ")}</div>
              </li>
            ))}
          </ul>
          <div className="row">
            <button className="btn ghost sm danger" onClick={() => confirm("Delete this workout?") && dispatch({ type: "deleteWorkout", id: w.id })}>Delete</button>
            <button className="btn ghost sm" onClick={() => { dispatch({ type: "saveWorkoutAsRoutine", workoutId: w.id }); alert("Saved as a routine."); }}>
              Save as routine
            </button>
          </div>
        </details>
      ))}
    </section>
  );
}
