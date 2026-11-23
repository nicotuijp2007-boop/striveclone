import { useApp } from "../context";
import { durationMinutes, formatKg, workoutVolume } from "../lib/stats";

export function HistoryView() {
  const { state, dispatch, exerciseById } = useApp();
  return (
    <section className="stack">
      <h2>History</h2>
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
