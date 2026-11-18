import { useEffect, useState } from "react";
import { useApp, useNow } from "../context";
import { ExercisePicker } from "../components/ExercisePicker";
import { NumberField } from "../components/NumberField";
import { FormVideoSheet } from "../components/FormVideoSheet";
import { bestEst1RM, completedSetCount, estimate1RM, formatKg, weekStreak, workoutVolume } from "../lib/stats";
import { formatClock, unlockAudio } from "../lib/audio";

export function WorkoutView({ goTo, openSettings }: { goTo: (tab: "routines") => void; openSettings: () => void }) {
  const { state } = useApp();
  return state.active ? <ActiveWorkout openSettings={openSettings} /> : <StartScreen goTo={goTo} />;
}

function StartScreen({ goTo }: { goTo: (tab: "routines") => void }) {
  const { state, dispatch, exerciseById } = useApp();
  const thisWeek = state.workouts.filter((w) => Date.now() - w.startedAt < 7 * 864e5);
  const streak = weekStreak(state.workouts);

  return (
    <section className="stack">
      <div className="stats-row">
        <Stat label="Last 7 days" value={`${thisWeek.length}`} unit="workouts" />
        <Stat label="Week streak" value={`${streak}`} unit={streak === 1 ? "week" : "weeks"} />
        <Stat label="Total" value={`${state.workouts.length}`} unit="workouts" />
      </div>

      <button className="btn primary big" onClick={() => dispatch({ type: "startWorkout" })}>
        Start empty workout
      </button>

      <div className="section-head">
        <h2>Start from a routine</h2>
        <button className="btn ghost sm" onClick={() => goTo("routines")}>Manage</button>
      </div>
      {state.routines.length === 0 && <p className="muted">No routines yet. Create one on the Routines tab.</p>}
      <div className="card-grid">
        {state.routines.map((r) => (
          <button key={r.id} className="card routine-card" onClick={() => dispatch({ type: "startWorkout", routineId: r.id })}>
            <strong>{r.name}</strong>
            <span className="muted small">
              {r.exercises.map((re) => exerciseById(re.exerciseId)?.name ?? "?").join(" · ") || "No exercises"}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="stat">
      <span className="muted small">{label}</span>
      <span className="stat-value">{value}</span>
      <span className="muted small">{unit}</span>
    </div>
  );
}

function ActiveWorkout({ openSettings }: { openSettings: () => void }) {
  const { state, dispatch, exerciseById, rest } = useApp();
  const w = state.active!;
  const now = useNow(true, 1000);
  const [picking, setPicking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [videoFor, setVideoFor] = useState<string | null>(null);
  const { restEnabled, autoRest, restSeconds, restSound, weightStep } = state.settings;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  /** Celebrate when a ticked set beats the best ever on a tracked lift. */
  const checkPR = (exerciseId: string, setId: string, weight: number, reps: number) => {
    if (!state.trackedPRs.some((t) => t.exerciseId === exerciseId) || weight <= 0) return;
    const otherDone = w.exercises
      .filter((we) => we.exerciseId === exerciseId)
      .flatMap((we) => we.sets)
      .filter((s) => s.done && s.id !== setId);
    const prev = bestEst1RM(state.workouts, state.manualPRs, exerciseId, otherDone);
    const est = estimate1RM(weight, reps);
    if (prev > 0 && est > prev) {
      setToast(`🏆 New ${exerciseById(exerciseId)?.name ?? ""} PR! ${weight} kg × ${reps} (≈ ${Math.round(est * 10) / 10} kg 1RM)`);
    }
  };

  const finish = () => {
    if (completedSetCount(w) === 0 && !confirm("No sets are ticked off, so nothing will be saved. Finish anyway?")) return;
    dispatch({ type: "finishWorkout" });
    rest.stop();
  };

  return (
    <section className="stack">
      <div className="workout-head">
        <input className="input title-input" aria-label="Workout name" value={w.name}
          onChange={(e) => dispatch({ type: "renameWorkout", name: e.target.value })} />
        <div className="workout-meta">
          <span>⏱ {formatClock((now - w.startedAt) / 1000)}</span>
          <span>{completedSetCount(w)} sets</span>
          <span>{formatKg(workoutVolume(w))}</span>
          {restEnabled && (
            <span className="row tight rest-setting">
              <button className="btn ghost sm" onClick={() => { unlockAudio(); rest.start(restSeconds); }}
                aria-label={`Start ${formatClock(restSeconds)} rest now`}>
                ⏱ Rest {formatClock(restSeconds)}
              </button>
              <button className="btn ghost sm" onClick={openSettings} aria-label="Rest timer settings">⚙</button>
            </span>
          )}
        </div>
      </div>

      {w.exercises.map((we) => {
        const ex = exerciseById(we.exerciseId);
        return (
          <div key={we.id} className="card">
            <div className="section-head">
              <h3>{ex?.name ?? "Unknown exercise"}</h3>
              <div className="row tight">
                <button className="btn ghost sm form-btn" onClick={() => setVideoFor(we.exerciseId)} aria-label={`Watch ${ex?.name ?? ""} form video`}>
                  ▶ Form
                </button>
                <button className="btn ghost sm danger" onClick={() => dispatch({ type: "removeExerciseFromWorkout", workoutExerciseId: we.id })}>
                  Remove
                </button>
              </div>
            </div>
            <div className="set-table">
              <div className="set-row head"><span>Set</span><span>kg</span><span>Reps</span><span>Done</span><span /></div>
              {we.sets.map((s, i) => (
                <div key={s.id} className={`set-row ${s.done ? "done" : ""}`}>
                  <span className="set-num">{i + 1}</span>
                  <WeightField label={`Set ${i + 1} weight`} value={s.weight} step={weightStep}
                    onChange={(n) => dispatch({ type: "updateSet", workoutExerciseId: we.id, setId: s.id, patch: { weight: n } })} />
                  <NumberField label={`Set ${i + 1} reps`} value={s.reps}
                    onChange={(n) => dispatch({ type: "updateSet", workoutExerciseId: we.id, setId: s.id, patch: { reps: Math.round(n) } })} />
                  <button
                    className={`check ${s.done ? "on" : ""}`}
                    aria-label={s.done ? "Mark set not done" : "Mark set done"}
                    aria-pressed={s.done}
                    onClick={() => {
                      dispatch({ type: "updateSet", workoutExerciseId: we.id, setId: s.id, patch: { done: !s.done } });
                      if (!s.done) {
                        checkPR(we.exerciseId, s.id, s.weight, s.reps);
                        if (restEnabled && autoRest) {
                          if (restSound) unlockAudio();
                          rest.start(restSeconds);
                        }
                      }
                    }}
                  >✓</button>
                  <button className="x" aria-label="Delete set"
                    onClick={() => dispatch({ type: "removeSet", workoutExerciseId: we.id, setId: s.id })}>×</button>
                </div>
              ))}
            </div>
            <button className="btn ghost full" onClick={() => dispatch({ type: "addSet", workoutExerciseId: we.id })}>+ Add set</button>
          </div>
        );
      })}

      <button className="btn secondary big" onClick={() => setPicking(true)}>+ Add exercise</button>

      <div className="row">
        <button className="btn ghost danger" onClick={() => {
          if (confirm("Discard this workout? Nothing will be saved.")) { dispatch({ type: "discardWorkout" }); rest.stop(); }
        }}>Discard</button>
        <button className="btn primary grow" onClick={finish}>Finish workout</button>
      </div>

      {videoFor && <FormVideoSheet exerciseId={videoFor} onClose={() => setVideoFor(null)} />}

      {toast && <div className="toast" role="status" onClick={() => setToast(null)}>{toast}</div>}

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(id) => { dispatch({ type: "addExerciseToWorkout", exerciseId: id }); setPicking(false); }}
        />
      )}
    </section>
  );
}

/** Weight input with − and + buttons that move it by the step chosen in Settings. */
function WeightField({ value, onChange, step, label }: { value: number; onChange: (n: number) => void; step: number; label: string }) {
  // Snap to the step grid first, so 61 with 2.5 steps goes to 62.5 / 60 rather than 63.5 / 58.5.
  const move = (dir: 1 | -1) => {
    const snapped = dir > 0 ? Math.floor(value / step + 1e-9) * step + step : Math.ceil(value / step - 1e-9) * step - step;
    onChange(Math.max(0, Math.round(snapped * 100) / 100));
  };
  return (
    <div className="weight-field">
      <button type="button" className="step-btn" aria-label={`${label}: minus ${step} kg`} onClick={() => move(-1)}>−</button>
      <NumberField label={label} value={value} step={step} onChange={onChange} />
      <button type="button" className="step-btn" aria-label={`${label}: plus ${step} kg`} onClick={() => move(1)}>+</button>
    </div>
  );
}
