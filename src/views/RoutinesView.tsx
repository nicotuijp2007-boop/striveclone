import { useState } from "react";
import { useApp } from "../context";
import { ExercisePicker } from "../components/ExercisePicker";
import { NumberField } from "../components/NumberField";
import { uid } from "../lib/id";
import type { Routine } from "../types";

export function RoutinesView({ onStarted }: { onStarted: () => void }) {
  const { state, dispatch, exerciseById } = useApp();
  const [editing, setEditing] = useState<Routine | null>(null);

  if (editing) return <RoutineEditor routine={editing} onDone={() => setEditing(null)} />;

  return (
    <section className="stack">
      <div className="section-head">
        <h2>Routines</h2>
        <button className="btn primary sm" onClick={() => setEditing({ id: uid(), name: "New routine", exercises: [] })}>
          + New
        </button>
      </div>
      {state.routines.length === 0 && <p className="muted">Routines are reusable workout templates. Create your first one.</p>}
      {state.routines.map((r) => (
        <div key={r.id} className="card">
          <div className="section-head">
            <h3>{r.name}</h3>
            <span className="muted small">{r.exercises.length} exercises</span>
          </div>
          <ul className="plain">
            {r.exercises.map((re, i) => (
              <li key={i} className="split">
                <span>{exerciseById(re.exerciseId)?.name ?? "?"}</span>
                <span className="muted">{re.sets} × {re.reps}{re.weight ? ` @ ${re.weight} kg` : ""}</span>
              </li>
            ))}
          </ul>
          <div className="row">
            <button className="btn ghost sm danger" onClick={() => confirm(`Delete “${r.name}”?`) && dispatch({ type: "deleteRoutine", id: r.id })}>Delete</button>
            <button className="btn ghost sm" onClick={() => setEditing(r)}>Edit</button>
            <button className="btn primary sm grow" disabled={!!state.active}
              title={state.active ? "Finish your current workout first" : undefined}
              onClick={() => { dispatch({ type: "startWorkout", routineId: r.id }); onStarted(); }}>
              Start
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}

function RoutineEditor({ routine, onDone }: { routine: Routine; onDone: () => void }) {
  const { dispatch, exerciseById } = useApp();
  const [draft, setDraft] = useState<Routine>(routine);
  const [picking, setPicking] = useState(false);

  const update = (i: number, patch: Partial<Routine["exercises"][number]>) =>
    setDraft((d) => ({ ...d, exercises: d.exercises.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const move = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      const ex = [...d.exercises];
      const j = i + dir;
      if (j < 0 || j >= ex.length) return d;
      [ex[i], ex[j]] = [ex[j], ex[i]];
      return { ...d, exercises: ex };
    });

  return (
    <section className="stack">
      <input className="input title-input" aria-label="Routine name" value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      {draft.exercises.map((re, i) => (
        <div key={i} className="card">
          <div className="section-head">
            <h3>{exerciseById(re.exerciseId)?.name ?? "?"}</h3>
            <div className="row tight">
              <button className="btn ghost sm" aria-label="Move up" onClick={() => move(i, -1)}>↑</button>
              <button className="btn ghost sm" aria-label="Move down" onClick={() => move(i, 1)}>↓</button>
              <button className="btn ghost sm danger" onClick={() => setDraft({ ...draft, exercises: draft.exercises.filter((_, j) => j !== i) })}>×</button>
            </div>
          </div>
          <div className="field-row">
            <label>Sets<NumberField label="Sets" value={re.sets} min={1} onChange={(n) => update(i, { sets: Math.max(1, Math.round(n)) })} /></label>
            <label>Reps<NumberField label="Reps" value={re.reps} onChange={(n) => update(i, { reps: Math.round(n) })} /></label>
            <label>kg<NumberField label="Weight" value={re.weight} step={2.5} onChange={(n) => update(i, { weight: n })} /></label>
          </div>
        </div>
      ))}
      <button className="btn secondary" onClick={() => setPicking(true)}>+ Add exercise</button>
      <div className="row">
        <button className="btn ghost" onClick={onDone}>Cancel</button>
        <button className="btn primary grow" disabled={!draft.name.trim()}
          onClick={() => { dispatch({ type: "saveRoutine", routine: { ...draft, name: draft.name.trim() } }); onDone(); }}>
          Save routine
        </button>
      </div>
      {picking && (
        <ExercisePicker onClose={() => setPicking(false)} onPick={(id) => {
          setDraft((d) => ({ ...d, exercises: [...d.exercises, { exerciseId: id, sets: 3, reps: 8, weight: 0 }] }));
          setPicking(false);
        }} />
      )}
    </section>
  );
}
