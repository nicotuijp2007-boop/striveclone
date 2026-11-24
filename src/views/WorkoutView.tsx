import { useEffect, useRef, useState } from "react";
import { useApp, useNow } from "../context";
import { ExercisePicker } from "../components/ExercisePicker";
import { NumberField } from "../components/NumberField";
import { OverloadPanel } from "../components/OverloadPanel";
import { FormVideoSheet } from "../components/FormVideoSheet";
import { bestEst1RM, completedSetCount, durationMinutes, estimate1RM, formatKg, weekStreak, workoutVolume } from "../lib/stats";
import { formatClock, unlockAudio } from "../lib/audio";
import type { AppState, WorkoutExercise } from "../types";
import { compareToLast, getProgression, liveProgress, type LastComparison } from "../lib/overload";

export function WorkoutView({ goTo }: { goTo: (tab: "routines") => void }) {
  const { state } = useApp();
  // Id of the workout just finished, for the "saved" summary on the start screen.
  const [saved, setSaved] = useState<Saved | null>(null);
  return state.active
    ? <ActiveWorkout onFinished={setSaved} />
    : <StartScreen goTo={goTo} savedInfo={saved} onDismiss={() => setSaved(null)} />;
}

/** The workout just finished, and on how many exercises it beat last time. */
interface Saved { id: string; better: number; compared: number }

const adviceIn = (state: AppState, we: WorkoutExercise) =>
  getProgression(state, we.exerciseId).enabled ? state.advice.find((a) => a.exerciseId === we.exerciseId) : undefined;

/** Set-by-set comparison with last time, or null when the exercise has no (enabled) advice. */
const compareFor = (state: AppState, we: WorkoutExercise): LastComparison | null => {
  const advice = adviceIn(state, we);
  return advice ? compareToLast(advice, we.sets) : null;
};

function StartScreen({ goTo, savedInfo, onDismiss }: { goTo: (tab: "routines") => void; savedInfo: Saved | null; onDismiss: () => void }) {
  const { state, dispatch, exerciseById } = useApp();
  const thisWeek = state.workouts.filter((w) => Date.now() - w.startedAt < 7 * 864e5);
  const streak = weekStreak(state.workouts);
  const saved = savedInfo ? state.workouts.find((w) => w.id === savedInfo.id) : undefined;

  return (
    <section className="stack">
      {saved && (
        <div className="saved-banner" role="status">
          <div className="saved-icon" aria-hidden="true">✓</div>
          <div className="grow">
            <strong>Workout saved</strong>
            <div className="muted small">
              {saved.name} · {durationMinutes(saved)} min · {completedSetCount(saved)} sets · {formatKg(workoutVolume(saved))}
            </div>
            {savedInfo!.compared > 0 && (
              <div className={`small saved-target ${savedInfo!.better === savedInfo!.compared ? "all" : ""}`}>
                Better than last time on {savedInfo!.better} of {savedInfo!.compared} exercise{savedInfo!.compared === 1 ? "" : "s"}
              </div>
            )}
            <div className="small muted">Next-time advice updated.</div>
          </div>
          <button className="x" aria-label="Dismiss" onClick={onDismiss}>×</button>
        </div>
      )}

      <div className="stats-row">
        <Stat label="Last 7 days" value={`${thisWeek.length}`} unit="workouts" />
        <Stat label="Week streak" value={`${streak}`} unit={streak === 1 ? "week" : "weeks"} />
        <Stat label="Total" value={`${state.workouts.length}`} unit="workouts" />
      </div>

      <button className="btn primary big" onClick={() => { onDismiss(); dispatch({ type: "startWorkout" }); }}>
        Start empty workout
      </button>

      <div className="section-head">
        <h2>Start from a routine</h2>
        <button className="btn ghost sm" onClick={() => goTo("routines")}>Manage</button>
      </div>
      {state.routines.length === 0 && <p className="muted">No routines yet. Create one on the Routines tab.</p>}
      <div className="card-grid">
        {state.routines.map((r) => (
          <button key={r.id} className="card routine-card" onClick={() => { onDismiss(); dispatch({ type: "startWorkout", routineId: r.id }); }}>
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

function ActiveWorkout({ onFinished }: { onFinished: (s: Saved) => void }) {
  const { state, dispatch, rest } = useApp();
  const w = state.active!;
  const now = useNow(true, 1000);
  const [picking, setPicking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [prSets, setPrSets] = useState<Set<string>>(() => new Set());
  const [videoFor, setVideoFor] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const finish = () => {
    const open = w.exercises.reduce((n, we) => n + we.sets.filter((s) => !s.done).length, 0);
    if (completedSetCount(w) === 0) {
      if (!confirm("No sets are ticked off, so nothing will be saved. Finish anyway?")) return;
    } else if (open > 0 && !confirm(`${open} set${open === 1 ? " isn't" : "s aren't"} ticked off and won't be saved. Finish anyway?`)) return;
    const id = w.id;
    // Compare with last time before finishing: finishing replaces the advice with next time's.
    const live = w.exercises.flatMap((we) => {
      const advice = adviceIn(state, we);
      const p = advice && liveProgress(advice, we.sets);
      return p ? [p] : [];
    });
    dispatch({ type: "finishWorkout" });
    rest.stop();
    if (completedSetCount(w) > 0) onFinished({ id, better: live.filter((p) => p.tone === "good").length, compared: live.length });
  };

  const done = completedSetCount(w);
  const total = w.exercises.reduce((n, we) => n + we.sets.length, 0);

  return (
    <section className="stack">
      <div className="wo-head">
        <div className="grow wo-title">
          <input className="input title-input" aria-label="Workout name" value={w.name}
            onChange={(e) => dispatch({ type: "renameWorkout", name: e.target.value })} />
          <div className="wo-meta">
            <span className="wo-clock">{formatClock((now - w.startedAt) / 1000)}</span>
            <span>{done}/{total} sets</span>
            <span>{formatKg(workoutVolume(w))}</span>
          </div>
        </div>
        <button className="btn primary sm" onClick={finish}>Finish</button>
      </div>

      {w.exercises.map((we) => (
        <ExerciseCard key={we.id} we={we} prSets={prSets} onVideo={() => setVideoFor(we.exerciseId)}
          onPR={(setId, msg) => { setPrSets((s) => new Set(s).add(setId)); setToast(msg); }} />
      ))}

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

function ExerciseCard({ we, prSets, onPR, onVideo }: {
  we: WorkoutExercise; prSets: Set<string>; onPR: (setId: string, msg: string) => void; onVideo: () => void;
}) {
  const { state, dispatch, exerciseById, rest } = useApp();
  const w = state.active!;
  const ex = exerciseById(we.exerciseId);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const doneCount = we.sets.filter((s) => s.done).length;
  const check = compareFor(state, we);

  /** Celebrate when a ticked set beats the best ever on a tracked lift. */
  const checkPR = (setId: string, weight: number, reps: number) => {
    if (!state.trackedPRs.some((t) => t.exerciseId === we.exerciseId) || weight <= 0) return;
    const otherDone = w.exercises
      .filter((x) => x.exerciseId === we.exerciseId)
      .flatMap((x) => x.sets)
      .filter((s) => s.done && s.id !== setId);
    const prev = bestEst1RM(state.workouts, state.manualPRs, we.exerciseId, otherDone);
    const est = estimate1RM(weight, reps);
    if (prev > 0 && est > prev) {
      onPR(setId, `🏆 New ${ex?.name ?? ""} PR! ${weight} kg × ${reps} (≈ ${Math.round(est * 10) / 10} kg 1RM)`);
    }
  };

  const advice = check ? state.advice.find((a) => a.exerciseId === we.exerciseId) : undefined;
  /** Target reps for each set, shown as a hint in the empty reps field. Warm-ups (lighter sets) get none. */
  const targetHint = (i: number): string | undefined => {
    if (!advice || we.sets[i].weight < advice.recommendedWeight) return undefined;
    const k = we.sets.slice(0, i).filter((x) => x.weight >= advice.recommendedWeight).length;
    return String(advice.targetReps[k] ?? advice.targetReps[advice.targetReps.length - 1]);
  };

  const toggle = (i: number) => {
    const s = we.sets[i];
    // A set can only be ticked once its reps are filled in, so the target check uses real numbers.
    if (!s.done && s.reps <= 0) {
      rowRefs.current.get(s.id)?.querySelector<HTMLInputElement>('input[aria-label$="reps"]')?.focus();
      return;
    }
    dispatch({ type: "updateSet", workoutExerciseId: we.id, setId: s.id, patch: { done: !s.done } });
    if (s.done) return;
    checkPR(s.id, s.weight, s.reps);
    const { restEnabled, autoRest, restSeconds, restSound } = state.settings;
    if (restEnabled && autoRest) {
      if (restSound) unlockAudio(); // browsers only allow sound after a tap
      rest.start(restSeconds);
    }
    // Bring the next open set into view, without opening the keyboard.
    const next = we.sets.slice(i + 1).find((x) => !x.done);
    if (next) rowRefs.current.get(next.id)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  const removeSet = (i: number) => {
    const s = we.sets[i];
    if (s.done && !confirm(`Delete set ${i + 1} (${s.weight} kg × ${s.reps})? It's already ticked off.`)) return;
    dispatch({ type: "removeSet", workoutExerciseId: we.id, setId: s.id });
  };

  return (
    <article className={`card ex-card ${doneCount === we.sets.length && doneCount > 0 ? "complete" : ""}`}>
      <header className="ex-head">
        <h3>{ex?.name ?? "Unknown exercise"}</h3>
        <span className="ex-count">{doneCount}/{we.sets.length}</span>
        <button className="icon-btn form-icon" aria-label={`Watch ${ex?.name ?? ""} form video`} title="Form video" onClick={onVideo}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" /></svg>
        </button>
        <button className="icon-btn" aria-label={`Remove ${ex?.name ?? "exercise"}`}
          onClick={() => confirm(`Remove ${ex?.name ?? "this exercise"} from this workout?`) &&
            dispatch({ type: "removeExerciseFromWorkout", workoutExerciseId: we.id })}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
          </svg>
        </button>
      </header>

      <OverloadPanel exerciseId={we.exerciseId} sets={we.sets} check={check} />

      <div className="set-table">
        <div className="set-row head"><span>Set</span><span>kg</span><span>Reps</span><span aria-hidden="true">✓</span><span /></div>
        {we.sets.map((s, i) => (
          <div key={s.id} ref={(el) => { if (el) rowRefs.current.set(s.id, el); else rowRefs.current.delete(s.id); }}
            className={`set-row ${s.done ? "done" : ""} ${check?.perSet[i] ? `vs-${check.perSet[i]}` : ""} ${prSets.has(s.id) && s.done ? "pr" : ""}`}>
            <span className="set-num">{prSets.has(s.id) && s.done ? "🏆" : i + 1}</span>
            <NumberField nav label={`Set ${i + 1} weight`} value={s.weight} step={2.5}
              onChange={(n) => dispatch({ type: "updateSet", workoutExerciseId: we.id, setId: s.id, patch: { weight: n } })} />
            <NumberField nav blankZero label={`Set ${i + 1} reps`} value={s.reps} placeholder={targetHint(i)}
              onChange={(n) => dispatch({ type: "updateSet", workoutExerciseId: we.id, setId: s.id, patch: { reps: Math.round(n) } })} />
            <button className={`check ${s.done ? "on" : ""}`} aria-label={s.done ? `Mark set ${i + 1} not done` : `Mark set ${i + 1} done`}
              aria-pressed={s.done} onClick={() => toggle(i)}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            </button>
            <button className="x" aria-label={`Delete set ${i + 1}`} onClick={() => removeSet(i)}>×</button>
          </div>
        ))}
      </div>
      <button className="btn ghost full add-set" onClick={() => dispatch({ type: "addSet", workoutExerciseId: we.id })}>+ Add set</button>
    </article>
  );
}
