import { useState } from "react";
import { useApp } from "../context";
import { NumberField } from "./NumberField";
import { STATUS_LABEL, STATUS_TONE, getProgression, liveProgress, shortReason, targetWeight } from "../lib/overload";
import type { SetEntry } from "../types";

const shortDate = (t: number) => new Date(t).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
const repsText = (reps: number[]) => reps.join(" / ");
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Progressive overload advice for one exercise in the active workout: previous vs recommended,
 * a one-line reason (full analysis and settings expandable), and accept / adjust actions.
 */
export function OverloadPanel({ exerciseId, sets }: { exerciseId: string; sets: SetEntry[] }) {
  const { state, dispatch } = useApp();
  const advice = state.advice.find((a) => a.exerciseId === exerciseId);
  const prog = getProgression(state, exerciseId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(0);

  const settings = (
    <div className="adv-settings">
      <div className="field-row">
        <label>Min reps
          <NumberField label="Minimum reps" value={prog.minReps}
            onChange={(n) => n >= 1 && dispatch({ type: "setProgression", exerciseId, patch: { minReps: Math.round(n) } })} />
        </label>
        <label>Max reps
          <NumberField label="Maximum reps" value={prog.maxReps}
            onChange={(n) => n >= 1 && dispatch({ type: "setProgression", exerciseId, patch: { maxReps: Math.round(n) } })} />
        </label>
        <label>Step (kg)
          <NumberField label="Weight increase in kg" value={prog.increment} step={0.5}
            onChange={(n) => n > 0 && dispatch({ type: "setProgression", exerciseId, patch: { increment: n } })} />
        </label>
      </div>
      <p className="muted small">Step is added once every set hits max reps. Use the smallest jump your plates, dumbbells or machine allow.</p>
      <label className="toggle small">
        <input type="checkbox" checked={prog.enabled}
          onChange={(e) => dispatch({ type: "setProgression", exerciseId, patch: { enabled: e.target.checked } })} />
        Progression advice for this exercise
      </label>
    </div>
  );

  if (!prog.enabled || !advice) {
    return (
      <details className="adv adv-empty">
        <summary>
          <span className="muted small">{prog.enabled ? "First time logged: advice starts after this workout." : "Progression advice is off."}</span>
          <span className="adv-more">Settings</span>
        </summary>
        {settings}
      </details>
    );
  }

  const target = targetWeight(advice);
  const adjusted = advice.adjustedWeight !== undefined;
  const accepted = !!advice.acceptedAt && !adjusted;
  const live = liveProgress(advice, sets);
  // Beating last time today outranks a stall or decline in earlier sessions: show that, not the old status.
  const improving = live?.tone === "good" && advice.status !== "increase";
  const tone = improving ? "good" : STATUS_TONE[advice.status];
  const label = improving ? "Progressing today" : STATUS_LABEL[advice.status];
  const summary = improving && (advice.status === "stagnation" || advice.status === "decline")
    ? `Better than last time: the ${advice.status === "stagnation" ? "plateau" : "downward trend"} is broken.`
    : shortReason(advice, prog);
  const step = prog.increment > 0 ? prog.increment : 0.5;

  return (
    <div className={`adv tone-${tone}`}>
      <div className="adv-top">
        <span className="adv-badge"><i aria-hidden="true" />{label}</span>
        {live && (
          <span className={`live-chip tone-${live.targetHit ? "good" : live.tone}`}>
            {live.targetHit ? "Target hit ✓" : live.text}
          </span>
        )}
      </div>

      <div className="adv-compare">
        <div className="adv-col">
          <span className="adv-label">Previous</span>
          <span className="adv-weight prev">{advice.lastWeight} kg</span>
          <span className="adv-sub">{repsText(advice.lastReps)}</span>
          <span className="adv-sub faint">{shortDate(advice.lastDate)}</span>
        </div>
        <span className="adv-arrow" aria-hidden="true">→</span>
        <div className="adv-col">
          <span className="adv-label">{adjusted ? "Your weight" : "Recommended"}</span>
          <span className="adv-weight rec">{target} kg</span>
          <span className="adv-sub">Target {repsText(advice.targetReps)}</span>
          <span className="adv-sub faint">Range {prog.minReps}–{prog.maxReps} reps</span>
        </div>
      </div>

      <details className="adv-why">
        <summary>
          <span>{summary}</span>
          <span className="adv-more">Details</span>
        </summary>
        <ul className="adv-reasons">
          {improving && <li>Status before today: {STATUS_LABEL[advice.status].toLowerCase()}.</li>}
          {advice.reasons.map((r, i) => <li key={i}>{r}</li>)}
          {adjusted && <li>You chose {advice.adjustedWeight} kg instead of the recommended {advice.recommendedWeight} kg.</li>}
        </ul>
        {settings}
      </details>

      {editing ? (
        <div className="adv-actions">
          <div className="stepper">
            <button className="btn secondary" aria-label={`Minus ${step} kg`} onClick={() => setDraft((d) => Math.max(0, r2(d - step)))}>−</button>
            <NumberField label="Your weight for today in kg" value={draft} step={step} onChange={setDraft} />
            <button className="btn secondary" aria-label={`Plus ${step} kg`} onClick={() => setDraft((d) => r2(d + step))}>+</button>
          </div>
          <button className="btn ghost" onClick={() => setEditing(false)}>Cancel</button>
          <button className="btn primary" onClick={() => { dispatch({ type: "adjustAdvice", exerciseId, weight: draft }); setEditing(false); }}>Save</button>
        </div>
      ) : (
        <div className="adv-actions">
          {accepted || adjusted ? (
            <span className="adv-ok grow">✓ Using {adjusted ? "your " : ""}{target} kg</span>
          ) : (
            <button className="btn primary grow" onClick={() => dispatch({ type: "acceptAdvice", exerciseId })}>
              Accept {advice.recommendedWeight} kg
            </button>
          )}
          {adjusted && (
            <button className="btn ghost" onClick={() => dispatch({ type: "acceptAdvice", exerciseId })}>Use {advice.recommendedWeight} kg</button>
          )}
          <button className={`btn ${accepted || adjusted ? "ghost" : "secondary"}`} onClick={() => { setDraft(target); setEditing(true); }}>Adjust</button>
        </div>
      )}
    </div>
  );
}
