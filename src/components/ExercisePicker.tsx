import { useMemo, useState } from "react";
import { useApp } from "../context";
import type { Muscle } from "../types";
import { MUSCLES } from "../lib/exercises";

// On phones, opening the keyboard straight away hides most of the list; let people browse first.
const touchScreen = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;

export function ExercisePicker({ onPick, onClose }: { onPick: (id: string) => void; onClose: () => void }) {
  const { state, dispatch } = useApp();
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState<Muscle | "All">("All");
  const [newMuscle, setNewMuscle] = useState<Muscle>("Chest");

  const list = useMemo(
    () =>
      state.exercises
        .filter((e) => muscle === "All" || e.muscle === muscle)
        .filter((e) => e.name.toLowerCase().includes(q.trim().toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [state.exercises, q, muscle]
  );

  const canCreate = q.trim().length > 1 && !state.exercises.some((e) => e.name.toLowerCase() === q.trim().toLowerCase());

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Choose exercise" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Add exercise</h2>
          <button className="btn ghost" onClick={onClose}>Close</button>
        </div>
        <input autoFocus={!touchScreen} className="input" placeholder="Search or name a new exercise" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="chips">
          {(["All", ...MUSCLES] as const).map((m) => (
            <button key={m} className={`chip ${muscle === m ? "on" : ""}`} onClick={() => setMuscle(m)}>{m}</button>
          ))}
        </div>
        {canCreate && (
          <div className="create-row">
            <select className="input" value={newMuscle} onChange={(e) => setNewMuscle(e.target.value as Muscle)}>
              {MUSCLES.map((m) => <option key={m}>{m}</option>)}
            </select>
            <button
              className="btn primary"
              onClick={() => {
                dispatch({ type: "addExercise", exercise: { name: q.trim(), muscle: newMuscle } });
                setQ("");
              }}
            >
              Create “{q.trim()}”
            </button>
          </div>
        )}
        <ul className="pick-list">
          {list.map((e) => (
            <li key={e.id}>
              <button onClick={() => onPick(e.id)}>
                <span>{e.name}</span>
                <span className="muted small">{e.muscle}</span>
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="muted empty">No exercises match.</li>}
        </ul>
      </div>
    </div>
  );
}
