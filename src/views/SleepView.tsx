import { useMemo, useState } from "react";
import { useApp } from "../context";
import { MoonIcon, SleepForm } from "../components/SleepForm";
import { averageMinutes, entryForDate, formatClock, formatDuration, lastNights, localDate } from "../lib/sleep";

const dayLabel = (date: string, opts: Intl.DateTimeFormatOptions) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, opts);

/** Sleep dashboard: last night, averages, the last 7 nights as bars, and the full history. */
export function SleepView() {
  const { state, dispatch } = useApp();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const today = localDate(Date.now());
  const entries = state.sleep;
  const last = entryForDate(entries, today) ?? entries[0];
  const avg7 = useMemo(() => averageMinutes(entries, 7, today), [entries, today]);
  const avg30 = useMemo(() => averageMinutes(entries, 30, today), [entries, today]);
  const week = useMemo(() => lastNights(entries, 7, today), [entries, today]);

  return (
    <section className="stack sleep-view">
      <div className="section-head">
        <h2>Sleep</h2>
        {!adding && <button className="btn primary sm" onClick={() => { setAdding(true); setEditing(null); }}>Log a night</button>}
      </div>

      {adding && (
        <div className="card sleep-card">
          <h3>Log a night</h3>
          <SleepForm onDone={() => setAdding(false)} secondary={<button className="btn ghost" onClick={() => setAdding(false)}>Cancel</button>} />
        </div>
      )}

      {!last ? (
        !adding && (
          <div className="card empty sleep-empty">
            <span className="sleep-accent"><MoonIcon size={28} /></span>
            <p className="muted">No nights logged yet. Log bedtime and wake-up each morning to see your time in bed here.</p>
          </div>
        )
      ) : (
        <>
          <div className="card sleep-hero">
            <span className="sleep-accent"><MoonIcon size={24} /></span>
            <strong className="sleep-big">{formatDuration(last.minutes)}</strong>
            <span className="sleep-label">Time in bed · {last.date === today ? "last night" : dayLabel(last.date, { weekday: "short", day: "numeric", month: "short" })}</span>
            <div className="sleep-pair">
              <div><span className="sleep-label">Bedtime</span><strong>{formatClock(last.bedAt)}</strong></div>
              <div><span className="sleep-label">Wake-up</span><strong>{formatClock(last.wakeAt)}</strong></div>
            </div>
          </div>

          <div className="sleep-stats">
            <div className="card sleep-stat"><span className="sleep-label">7-day average</span><strong>{avg7 === null ? "–" : formatDuration(avg7)}</strong></div>
            <div className="card sleep-stat"><span className="sleep-label">30-day average</span><strong>{avg30 === null ? "–" : formatDuration(avg30)}</strong></div>
          </div>

          <div className="card">
            <h3>Last 7 nights</h3>
            <WeekBars nights={week} today={today} />
          </div>
        </>
      )}

      {entries.length > 0 && (
        <div className="card">
          <h3>History</h3>
          <ul className="plain sleep-list">
            {entries.map((e) => (
              <li key={e.id} className="sleep-item">
                {editing === e.id ? (
                  <SleepForm entry={e} saveLabel="Save changes" onDone={() => setEditing(null)}
                    secondary={<button className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>} />
                ) : (
                  <div className="split">
                    <div className="sleep-item-text">
                      <strong>{dayLabel(e.date, { weekday: "short", day: "numeric", month: "short" })}</strong>
                      <span className="muted small">{formatClock(e.bedAt)} → {formatClock(e.wakeAt)}</span>
                    </div>
                    <span className="sleep-dur">{formatDuration(e.minutes)}</span>
                    <div className="row tight">
                      <button className="btn ghost sm" onClick={() => { setEditing(e.id); setAdding(false); }}>Edit</button>
                      <button className="btn ghost sm danger" aria-label={`Delete ${e.date}`}
                        onClick={() => confirm("Delete this night?") && dispatch({ type: "deleteSleep", id: e.id })}>Delete</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Inline SVG bars (no chart library), height = time in bed, with gridlines every 2 hours (4 above 12h), at least up to 10h. */
function WeekBars({ nights, today }: { nights: { date: string; minutes: number | null }[]; today: string }) {
  const W = 320, H = 150, top = 18, bottom = 22, left = 26;
  const maxH = Math.max(10, ...nights.map((n) => Math.ceil((n.minutes ?? 0) / 60)));
  const y = (min: number) => top + (H - top - bottom) * (1 - min / (maxH * 60));
  const slot = (W - left) / nights.length;
  const bw = Math.min(30, slot * 0.6);
  const step = maxH > 12 ? 4 : 2;
  const grid = Array.from({ length: Math.floor(maxH / step) + 1 }, (_, i) => i * step);
  return (
    <svg className="sleep-chart" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`Time in bed, last 7 nights: ${nights.map((n) => n.minutes === null ? "none" : formatDuration(n.minutes)).join(", ")}`}>
      {grid.map((h) => (
        <g key={h}>
          <line x1={left} x2={W} y1={y(h * 60)} y2={y(h * 60)} className="sleep-grid" />
          <text x={left - 6} y={y(h * 60) + 3} textAnchor="end" className="sleep-axis">{h}h</text>
        </g>
      ))}
      {nights.map((n, i) => {
        const cx = left + slot * i + slot / 2;
        return (
          <g key={n.date}>
            {n.minutes !== null && (
              <>
                <rect x={cx - bw / 2} y={y(n.minutes)} width={bw} height={y(0) - y(n.minutes)} rx="5" className="sleep-bar" />
                <text x={cx} y={y(n.minutes) - 5} textAnchor="middle" className="sleep-bar-val">{(n.minutes / 60).toFixed(1)}</text>
              </>
            )}
            <text x={cx} y={H - 6} textAnchor="middle" className={`sleep-axis ${n.date === today ? "today" : ""}`}>
              {dayLabel(n.date, { weekday: "narrow" })}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
