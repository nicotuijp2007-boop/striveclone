import { useMemo } from "react";
import { useApp } from "../context";
import { formatKg, weekReport, type WeekTotals } from "../lib/stats";

const fmtTime = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

const METRICS: { key: keyof WeekTotals; label: string; format: (n: number) => string }[] = [
  { key: "workouts", label: "Workouts", format: String },
  { key: "sets", label: "Sets", format: String },
  { key: "volume", label: "Volume", format: formatKg },
  { key: "minutes", label: "Time", format: fmtTime },
];

/** This week so far against the same point last week, plus the PRs set this week. */
export function WeekSummary() {
  const { state, exerciseById } = useApp();
  const report = useMemo(() => weekReport(state.workouts, state.manualPRs), [state.workouts, state.manualPRs]);
  const { thisWeek, lastWeek, newPRs } = report;

  return (
    <div className="card">
      <div className="section-head">
        <h3>This week</h3>
        <span className="muted small">vs same point last week</span>
      </div>
      <div className="week-metrics">
        {METRICS.map(({ key, label, format }) => {
          const diff = thisWeek[key] - lastWeek[key];
          const cls = diff > 0 ? "up" : diff < 0 ? "down" : "same";
          return (
            <div key={key} className="week-metric">
              <span className="muted small">{label}</span>
              <strong>{format(thisWeek[key])}</strong>
              <span className={`delta ${cls}`}>
                {diff === 0 ? "same" : `${diff > 0 ? "▲" : "▼"} ${format(Math.abs(diff))}`}
              </span>
            </div>
          );
        })}
      </div>
      <div className="week-prs">
        <span className="muted small">New PRs</span>
        {newPRs.length === 0 ? (
          <p className="muted small none">None yet this week.</p>
        ) : (
          <ul className="plain">
            {newPRs.map((pr) => (
              <li key={pr.exerciseId} className="week-pr">
                <span className="week-pr-icon" aria-hidden="true">🏆</span>
                <span className="week-pr-name">{exerciseById(pr.exerciseId)?.name ?? "?"}</span>
                <span className="week-pr-detail">
                  <strong>{pr.weight} kg × {pr.reps}</strong>
                  <span className="up"> +{Math.round((pr.est1RM - pr.previous) * 10) / 10} kg est. 1RM</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
