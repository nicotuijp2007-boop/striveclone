import { useMemo } from "react";
import { dailyActivity, dayKey, formatKg, intensityLevel, type DayActivity } from "../lib/stats";
import type { Workout } from "../types";

const mondayIndex = (d: Date) => (d.getDay() + 6) % 7;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const tip = (date: Date, a?: DayActivity) =>
  `${date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}: ` +
  (a ? `${a.names.join(", ")} · ${formatKg(a.volume)}` : "rest day");

function useActivity(workouts: Workout[]) {
  return useMemo(() => {
    const days = dailyActivity(workouts);
    const max = Math.max(0, ...[...days.values()].map((d) => d.volume));
    return { days, max };
  }, [workouts]);
}

const CELL = 10;
const STEP = 12.5;

/** Dense training heatmap: one column per week (oldest left), Monday at the top. Brighter = more volume. */
export function TrainingHeatmap({ workouts, now = new Date(), weeks = 36 }: { workouts: Workout[]; now?: Date; weeks?: number }) {
  const { days, max } = useActivity(workouts);
  const today = dayKey(now);
  const start = addDays(now, -mondayIndex(now) - (weeks - 1) * 7);
  const trained = [...days.keys()].filter((k) => k >= dayKey(start) && k <= today).length;

  return (
    <figure className="dash-block">
      <div className="card heat-card">
        {/* SVG keeps every square identical and scales the grid to any width. */}
        <svg className="heat-svg" viewBox={`0 0 ${weeks * STEP - (STEP - CELL)} ${7 * STEP - (STEP - CELL)}`} role="img"
          aria-label={`${trained} training days in the last ${weeks} weeks`}>
          {Array.from({ length: weeks }, (_, w) =>
            Array.from({ length: 7 }, (_, d) => {
              const date = addDays(start, w * 7 + d);
              const k = dayKey(date);
              if (k > today) return null;
              const a = days.get(k);
              return (
                <rect key={k} x={w * STEP} y={d * STEP} width={CELL} height={CELL} rx={2}
                  className={`lvl-${intensityLevel(a?.volume ?? 0, max, !!a)} ${k === today ? "today" : ""}`}>
                  <title>{tip(date, a)}</title>
                </rect>
              );
            })
          )}
        </svg>
      </div>
      <figcaption>
        Training days, last {weeks} weeks · <strong>{trained}</strong>
      </figcaption>
    </figure>
  );
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Mon–Sun row for the current week: a check for each training day, ×N when you trained more than once. */
export function WeekChecks({ workouts, now = new Date() }: { workouts: Workout[]; now?: Date }) {
  const { days } = useActivity(workouts);
  const monday = addDays(now, -mondayIndex(now));
  const today = dayKey(now);
  const total = WEEKDAYS.reduce((n, _, i) => n + (days.get(dayKey(addDays(monday, i)))?.workouts ?? 0), 0);

  return (
    <figure className="dash-block">
      <div className="card week-checks">
        {WEEKDAYS.map((label, i) => {
          const date = addDays(monday, i);
          const k = dayKey(date);
          const a = days.get(k);
          const state = a ? "done" : k > today ? "future" : "missed";
          return (
            <div key={label} className={`wk-day ${state} ${k === today ? "is-today" : ""}`} title={tip(date, a)}>
              <span className="wk-label">{label}</span>
              <span className="wk-icon">
                <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {a && a.workouts > 1 && <span className="wk-count">×{a.workouts}</span>}
              </span>
              <span className="sr-only">{a ? `${a.workouts} workout${a.workouts > 1 ? "s" : ""}` : "no workout"}</span>
            </div>
          );
        })}
      </div>
      <figcaption>
        Workouts this week · <strong>{total}</strong>
      </figcaption>
    </figure>
  );
}
