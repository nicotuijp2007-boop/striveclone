import { useState } from "react";
import { useApp } from "../context";
import { NumberField } from "./NumberField";
import { STATUS_LABEL, STATUS_TONE, getProgression, liveProgress, shortReason, type LastComparison } from "../lib/overload";
import type { SetEntry } from "../types";

const shortDate = (t: number) => new Date(t).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
const repsText = (reps: number[]) => reps.join(" / ");

/**
 * Progressive overload advice for one exercise in the active workout: previous vs recommended,
 * with the reasoning, today's analysis and settings behind Details. The user logs whatever they
 * choose; `check` compares each ticked set with the same set last time.
 */
export function OverloadPanel({ exerciseId, sets, check }: { exerciseId: string; sets: SetEntry[]; check: LastComparison | null }) {
  const { state, dispatch } = useApp();
  const advice = state.advice.find((a) => a.exerciseId === exerciseId);
  const prog = getProgression(state, exerciseId);
  // All explanation text lives behind this toggle, so the card shows only numbers and actions.
  const [open, setOpen] = useState(false);
  const toggle = (
    <button className="adv-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>Details</button>
  );

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
      <div className="adv adv-empty">
        <div className="adv-top">
          <span className="adv-badge muted-badge"><i aria-hidden="true" />{prog.enabled ? "No advice yet" : "Advice off"}</span>
          {toggle}
        </div>
        {open && (
          <div className="adv-details">
            <p className="adv-summary">
              {prog.enabled ? "Advice starts after you finish this exercise once." : "Turn progression advice on below to get a recommendation."}
            </p>
            {settings}
          </div>
        )}
      </div>
    );
  }

  const live = liveProgress(advice, sets);
  // Today's analysis, listed under Details.
  const today: string[] = [];
  if (check && check.up + check.same + check.down > 0) {
    const parts = [check.up && `${check.up} better`, check.same && `${check.same} the same`, check.down && `${check.down} lower`].filter(Boolean);
    today.push(`Today vs last time, set by set: ${parts.join(", ")}.`);
    let k = 0;
    sets.forEach((st, i) => {
      const r = check.perSet[i];
      if (r === null) return;
      const prev = advice.lastReps[k];
      if (r === "down") today.push(`Set ${i + 1}: ${st.weight} kg × ${st.reps}, last time ${advice.lastWeight} kg × ${prev}.`);
      k += 1;
    });
  }
  if (live) today.push(`${live.text}.`);
  // Beating last time today outranks a stall or decline in earlier sessions: show that, not the old status.
  const improving = live?.tone === "good" && advice.status !== "increase";
  const tone = improving ? "good" : STATUS_TONE[advice.status];
  const label = improving ? "Progressing today" : STATUS_LABEL[advice.status];
  const summary = improving && (advice.status === "stagnation" || advice.status === "decline")
    ? `Better than last time: the ${advice.status === "stagnation" ? "plateau" : "downward trend"} is broken.`
    : shortReason(advice, prog);

  return (
    <div className={`adv tone-${tone}`}>
      <div className="adv-top">
        <span className="adv-badge"><i aria-hidden="true" />{label}</span>
        {toggle}
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
          <span className="adv-label">Recommended</span>
          <span className="adv-weight rec">{advice.recommendedWeight} kg</span>
          <span className="adv-sub">Target {repsText(advice.targetReps)}</span>
          <span className="adv-sub faint">Range {prog.minReps}–{prog.maxReps} reps</span>
        </div>
      </div>

      {open && (
        <div className="adv-details">
        <p className="adv-summary">{summary}</p>
        {today.length > 0 && (
          <ul className="adv-reasons adv-today">
            {today.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        )}
        <ul className="adv-reasons">
          {improving && <li>Status before today: {STATUS_LABEL[advice.status].toLowerCase()}.</li>}
          {advice.reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
        {settings}
        </div>
      )}
    </div>
  );
}
