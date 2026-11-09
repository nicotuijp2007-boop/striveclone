import { useMemo, useState } from "react";
import { useApp } from "../context";
import { ExercisePicker } from "./ExercisePicker";
import { NumberField } from "./NumberField";
import { personalRecords } from "../lib/stats";

const fmtDate = (t: number) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const todayISO = () => new Date().toISOString().slice(0, 10);

/** The lifts the user chose to follow: current best, goal progress, and hand-entered PRs. */
export function TrackedPRs() {
  const { state, dispatch, exerciseById } = useApp();
  const [picking, setPicking] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const records = useMemo(
    () => new Map(personalRecords(state.workouts, state.manualPRs).map((r) => [r.exerciseId, r])),
    [state.workouts, state.manualPRs]
  );

  return (
    <div className="card">
      <div className="section-head">
        <h3>Tracked PRs</h3>
        <button className="btn primary sm" onClick={() => setPicking(true)}>+ Track a lift</button>
      </div>

      {state.trackedPRs.length === 0 && (
        <p className="muted">Choose the lifts you care about, for example bench, squat and deadlift, to keep their PRs and goals here.</p>
      )}

      {state.trackedPRs.map((t) => {
        const ex = exerciseById(t.exerciseId);
        const pr = records.get(t.exerciseId);
        const pct = t.goalKg && pr ? Math.min(100, (pr.est1RM / t.goalKg) * 100) : 0;
        const reached = !!t.goalKg && !!pr && pr.est1RM >= t.goalKg;
        const isOpen = open === t.exerciseId;
        return (
          <div key={t.exerciseId} className="tracked">
            <button className="tracked-main" onClick={() => setOpen(isOpen ? null : t.exerciseId)} aria-expanded={isOpen}>
              <div className="split">
                <strong>{ex?.name ?? "Unknown exercise"}</strong>
                {pr ? (
                  <span className="tracked-best">{pr.weight} kg × {pr.reps}</span>
                ) : (
                  <span className="muted small">No PR yet</span>
                )}
              </div>
              <div className="split muted small">
                <span>{pr ? `≈ ${pr.est1RM} kg 1RM · ${fmtDate(pr.date)}${pr.manual ? " · entered by hand" : ""}` : "Log it in a workout or enter one below"}</span>
                {t.goalKg && <span className={reached ? "goal-hit" : ""}>{reached ? "Goal reached 🎉" : `Goal ${t.goalKg} kg`}</span>}
              </div>
              {t.goalKg && <div className="progress goal-bar"><div style={{ width: `${pct}%` }} /></div>}
            </button>
            {isOpen && <TrackedDetails exerciseId={t.exerciseId} goalKg={t.goalKg} onRemove={() => setOpen(null)} />}
          </div>
        );
      })}

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(id) => {
            dispatch({ type: "trackPR", exerciseId: id });
            setOpen(id);
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

function TrackedDetails({ exerciseId, goalKg, onRemove }: { exerciseId: string; goalKg?: number; onRemove: () => void }) {
  const { state, dispatch } = useApp();
  const [goal, setGoal] = useState(goalKg ?? 0);
  const [weight, setWeight] = useState(0);
  const [reps, setReps] = useState(1);
  const [date, setDate] = useState(todayISO());
  const manual = state.manualPRs.filter((m) => m.exerciseId === exerciseId).sort((a, b) => b.date - a.date);

  return (
    <div className="tracked-details">
      <label className="inline-field">
        <span>Goal (1RM, kg)</span>
        <NumberField label="Goal in kg" value={goal} step={2.5} onChange={setGoal} />
        <button className="btn secondary sm" onClick={() => dispatch({ type: "setPRGoal", exerciseId, goalKg: goal || undefined })}>
          {goal ? "Set goal" : "Clear goal"}
        </button>
      </label>

      <div>
        <div className="small muted">Enter a PR by hand, for example one you set before using the app</div>
        <div className="manual-row">
          <label>kg<NumberField label="PR weight" value={weight} step={2.5} onChange={setWeight} /></label>
          <label>Reps<NumberField label="PR reps" value={reps} min={1} onChange={(n) => setReps(Math.max(1, Math.round(n)))} /></label>
          <label>Date<input className="input" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} /></label>
        </div>
        <button
          className="btn primary sm full"
          disabled={weight <= 0 || !date}
          onClick={() => {
            dispatch({ type: "addManualPR", exerciseId, weight, reps, date: new Date(`${date}T12:00:00`).getTime() });
            setWeight(0);
          }}
        >
          Add PR
        </button>
      </div>

      {manual.length > 0 && (
        <ul className="plain">
          {manual.map((m) => (
            <li key={m.id} className="split small">
              <span className="muted">{fmtDate(m.date)}</span>
              <span>
                {m.weight} kg × {m.reps}{" "}
                <button className="x" aria-label="Delete entered PR" onClick={() => dispatch({ type: "deleteManualPR", id: m.id })}>×</button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <button className="btn ghost sm danger" onClick={() => { dispatch({ type: "untrackPR", exerciseId }); onRemove(); }}>
        Stop tracking
      </button>
    </div>
  );
}
