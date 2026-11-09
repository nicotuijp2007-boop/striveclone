import { useMemo, useState } from "react";
import { dailyActivity, dayKey, formatKg, intensityLevel, type DayActivity } from "../lib/stats";
import type { Workout } from "../types";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const mondayIndex = (d: Date) => (d.getDay() + 6) % 7;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const monthName = (d: Date, style: "long" | "short" = "long") => d.toLocaleDateString(undefined, { month: style });

const tip = (date: Date, a?: DayActivity) =>
  `${date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}: ` +
  (a ? `${a.names.join(", ")} · ${formatKg(a.volume)}` : "rest day");

function useActivity(workouts: Workout[]) {
  return useMemo(() => {
    const days = dailyActivity(workouts);
    const max = Math.max(0, ...[...days.values()].map((d) => d.volume));
    return { days, max };
  }, [workouts]);
}

function Legend() {
  return (
    <div className="cal-legend muted small">
      <span>Less</span>
      {[0, 1, 2, 3, 4].map((l) => <i key={l} className={`lvl-${l}`} />)}
      <span>More</span>
    </div>
  );
}

/* ── Option A: month calendar ─────────────────────────────────────────── */

export function MonthCalendar({ workouts, now = new Date() }: { workouts: Workout[]; now?: Date }) {
  const { days } = useActivity(workouts);
  const [offset, setOffset] = useState(0);
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const today = dayKey(now);

  const cells: (Date | null)[] = [
    ...Array.from({ length: mondayIndex(first) }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => addDays(first, i)),
  ];
  const trained = cells.filter((d) => d && days.has(dayKey(d))).length;
  const elapsed = offset === 0 ? now.getDate() : offset < 0 ? daysInMonth : 0;

  return (
    <div className="card">
      <div className="section-head">
        <button className="btn ghost sm" aria-label="Previous month" onClick={() => setOffset(offset - 1)}>‹</button>
        <h3>{monthName(first)} {first.getFullYear() !== now.getFullYear() ? first.getFullYear() : ""}</h3>
        <button className="btn ghost sm" aria-label="Next month" disabled={offset >= 0} onClick={() => setOffset(offset + 1)}>›</button>
      </div>
      <div className="cal-month">
        {WEEKDAYS.map((d, i) => <span key={i} className="cal-wd">{d}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const k = dayKey(d);
          const a = days.get(k);
          return (
            <span key={i} title={tip(d, a)}
              className={`cal-day ${a ? "on" : ""} ${k === today ? "today" : ""} ${k > today ? "future" : ""}`}>
              {d.getDate()}
            </span>
          );
        })}
      </div>
      <div className="split small">
        <span><strong>{trained}</strong> <span className="muted">workout days</span></span>
        <span className="muted">{elapsed ? `${Math.round((trained / elapsed) * 100)}% of days so far` : ""}</span>
      </div>
    </div>
  );
}

/* ── Option B: contribution-style heatmap ────────────────────────────── */

const CELL = 10;
const STEP = 13;
const LABEL_W = 24;
const TOP_H = 14;

export function YearHeatmap({ workouts, now = new Date(), weeks = 26 }: { workouts: Workout[]; now?: Date; weeks?: number }) {
  const { days, max } = useActivity(workouts);
  const end = addDays(now, 6 - mondayIndex(now)); // Sunday of this week
  const start = addDays(end, -(weeks * 7 - 1));
  const today = dayKey(now);

  const columns = Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
  const total = [...days.keys()].filter((k) => k >= dayKey(start) && k <= today).length;

  return (
    <div className="card">
      <div className="section-head">
        <h3>Last 6 months</h3>
        <span className="muted small"><strong className="fg">{total}</strong> workout days</span>
      </div>
      {/* SVG keeps every square identical and lets the grid scale to any width. */}
      <svg className="heat-svg" viewBox={`0 0 ${LABEL_W + weeks * STEP} ${TOP_H + 7 * STEP}`} role="img"
        aria-label={`${total} workout days in the last ${weeks} weeks`}>
        {["Mon", "Wed", "Fri"].map((l, i) => (
          <text key={l} x={0} y={TOP_H + i * 2 * STEP + CELL - 1} className="heat-label">{l}</text>
        ))}
        {columns.map((col, w) => {
          // Label a column with its month when the month starts inside that week.
          const firstOfMonth = col.find((d) => d.getDate() === 1);
          return (
            <g key={w} transform={`translate(${LABEL_W + w * STEP} 0)`}>
              {firstOfMonth && w < weeks - 1 && <text x={0} y={TOP_H - 4} className="heat-label">{monthName(firstOfMonth, "short")}</text>}
              {col.map((d, i) => {
                const k = dayKey(d);
                if (k > today) return null;
                const a = days.get(k);
                return (
                  <rect key={k} x={0} y={TOP_H + i * STEP} width={CELL} height={CELL} rx={2}
                    className={`lvl-${intensityLevel(a?.volume ?? 0, max, !!a)}`}>
                    <title>{tip(d, a)}</title>
                  </rect>
                );
              })}
            </g>
          );
        })}
      </svg>
      <Legend />
    </div>
  );
}

/* ── Option C: one row of squares per month ──────────────────────────── */

export function MonthStrips({ workouts, now = new Date(), months = 6 }: { workouts: Workout[]; now?: Date; months?: number }) {
  const { days, max } = useActivity(workouts);
  const today = dayKey(now);
  const rows = Array.from({ length: months }, (_, i) => new Date(now.getFullYear(), now.getMonth() - i, 1));

  return (
    <div className="card">
      <h3>Training by month</h3>
      <div className="strips">
        {rows.map((m) => {
          const n = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
          const cells = Array.from({ length: n }, (_, i) => addDays(m, i));
          const count = cells.filter((d) => days.has(dayKey(d))).length;
          return (
            <div key={m.getTime()} className="strip">
              <span className="strip-label">{monthName(m, "short")}</span>
              <div className="strip-cells">
                {Array.from({ length: 31 }, (_, i) => {
                  const d = cells[i];
                  if (!d) return <i key={i} className="strip-cell blank" />;
                  const k = dayKey(d);
                  const a = days.get(k);
                  return k > today
                    ? <i key={i} className="strip-cell future" />
                    : <i key={i} title={tip(d, a)}
                        className={`strip-cell lvl-${intensityLevel(a?.volume ?? 0, max, !!a)}`} />;
                })}
              </div>
              <span className="strip-count"><strong>{count}</strong></span>
            </div>
          );
        })}
      </div>
      <Legend />
    </div>
  );
}
