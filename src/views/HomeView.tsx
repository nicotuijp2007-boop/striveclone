import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useApp } from "../context";
import { arrangeTiles, moveTile, periodDays, periodLabel, toggleHidden } from "../lib/dashboard";
import type { DashboardLayout, DashboardMonths } from "../types";
import { WeekChecks } from "../components/ActivityCalendar";
import { Sparkline } from "../components/Sparkline";
import { e1rmPoints, formatKg, trendOver, weekReport, type Trend } from "../lib/stats";
import { SleepCheckIn, MoonIcon } from "../components/SleepForm";
import { SleepView } from "./SleepView";
import { averageMinutes, formatDuration, localDate, shouldShowCheckIn } from "../lib/sleep";

const PERIODS: DashboardMonths[] = [1, 3, 6, 12];

/** The first screen: start training quickly and see everything you track at a glance. */
export function HomeView({ goTo }: { goTo: (tab: "workout" | "progress" | "routines") => void }) {
  const { state, dispatch, exerciseById } = useApp();
  // While editing, changes go to a draft; Done saves it, Cancel throws it away.
  const [draft, setDraft] = useState<DashboardLayout | null>(null);
  const editing = draft !== null;
  const layout = draft ?? state.settings.dashboard;
  const days = periodDays(layout.months);
  const period = periodLabel(layout.months);

  const lifts = useMemo(
    () => state.trackedPRs.map((t) => ({
      id: `lift:${t.exerciseId}`,
      title: exerciseById(t.exerciseId)?.name ?? "Unknown exercise",
      trend: trendOver(e1rmPoints(state.workouts, state.manualPRs, t.exerciseId), days),
      goal: t.goalKg,
    })),
    [state.trackedPRs, state.workouts, state.manualPRs, exerciseById, days]
  );
  const weight = useMemo(
    () => trendOver(state.bodyWeight.map((b) => ({ t: new Date(`${b.date}T12:00:00`).getTime(), v: b.kg })), days),
    [state.bodyWeight, days]
  );
  const week = useMemo(() => weekReport(state.workouts, state.manualPRs), [state.workouts, state.manualPRs]);
  const sleepOn = state.settings.sleepTracking;
  // Sleep has no tab of its own: the dashboard tile opens its details here, on Home.
  const [sleepOpen, setSleepOpen] = useState(false);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [sleepOpen]);
  const sleepTrend = useMemo(
    // Plotted at the wake-up time: a noon timestamp would still be "in the future" this morning.
    () => trendOver(state.sleep.map((e) => ({ t: e.wakeAt, v: e.minutes })), 30),
    [state.sleep]
  );

  const tiles = new Map<string, ReactNode>([
    ["week", (
      <Tile title="This week" caption="Volume vs last week" editing={editing}
        value={`${week.thisWeek.workouts}`} unit={week.thisWeek.workouts === 1 ? "workout" : "workouts"}
        sub={`${formatKg(week.thisWeek.volume)} volume`}
        delta={week.thisWeek.volume - week.lastWeek.volume} deltaText={deltaKg(week.thisWeek.volume - week.lastWeek.volume)}
        onClick={() => goTo("progress")} />
    )],
    ["bodyweight", (
      <TrendTile title="Body weight" caption={cap(period)} trend={weight} empty="Log your weight on Progress"
        onClick={() => goTo("progress")} lowerIsNeutral editing={editing} />
    )],
    // Sleep tracking off: the tile is left out entirely (its place in the saved order is kept).
    ...(sleepOn ? [["sleep", (
      <SleepTile minutes={state.sleep[0]?.minutes ?? null} avg7={averageMinutes(state.sleep, 7, localDate(Date.now()))}
        series={sleepTrend.series} onClick={() => setSleepOpen(true)} editing={editing} />
    )] as [string, ReactNode]] : []),
    ...lifts.map((t): [string, ReactNode] => [t.id, (
      <TrendTile title={t.title} caption={`Est. 1RM · ${period}`} trend={t.trend} goal={t.goal}
        empty="Not enough data yet" onClick={() => goTo("progress")} editing={editing} />
    )]),
  ]);
  const ids = arrangeTiles([...tiles.keys()], layout.order);
  // Hidden tiles stay visible (dimmed) while editing, so they can be shown again.
  const shown = editing ? ids : ids.filter((id) => !layout.hidden.includes(id));

  const start = (routineId?: string) => {
    dispatch({ type: "startWorkout", routineId });
    goTo("workout");
  };

  if (sleepOn && sleepOpen) return <SleepView onClose={() => setSleepOpen(false)} />;

  return (
    <section className="stack">
      {shouldShowCheckIn(state) && <SleepCheckIn />}

      {state.active ? (
        <button className="card resume" onClick={() => goTo("workout")}>
          <span className="muted small">Workout in progress</span>
          <strong>{state.active.name}</strong>
          <span className="resume-cta">Continue →</span>
        </button>
      ) : (
        <div className="card">
          <div className="section-head">
            <h3>Start a workout</h3>
            <button className="btn ghost sm" onClick={() => goTo("routines")}>Routines</button>
          </div>
          <div className="quick-start">
            {state.routines.map((r) => (
              <button key={r.id} className="btn secondary" onClick={() => start(r.id)}>{r.name}</button>
            ))}
            <button className="btn ghost" onClick={() => start()}>Empty</button>
          </div>
        </div>
      )}

      <WeekChecks workouts={state.workouts} />

      <div className="section-head">
        <h2>Dashboard</h2>
        {editing ? (
          <div className="row tight">
            <button className="btn ghost sm" onClick={() => setDraft(null)}>Cancel</button>
            <button className="btn primary sm" onClick={() => {
              dispatch({ type: "updateSettings", patch: { dashboard: { ...layout, order: ids } } });
              setDraft(null);
            }}>Done</button>
          </div>
        ) : (
          <button className="btn ghost sm" onClick={() => setDraft({ ...layout, order: ids })}>Edit</button>
        )}
      </div>

      {editing && (
        <div className="card dash-edit">
          <div className="setting-block">
            <span>Period for charts</span>
            <div className="segmented" role="radiogroup" aria-label="Chart period">
              {PERIODS.map((m) => (
                <button key={m} role="radio" aria-checked={layout.months === m} className={layout.months === m ? "on" : ""}
                  onClick={() => setDraft({ ...layout, months: m })}>{m === 12 ? "1 yr" : `${m} mo`}</button>
              ))}
            </div>
          </div>
          <p className="muted small">Use the eye to show or hide a tile, and the arrows to move it. Tap Done to save.</p>
        </div>
      )}

      <div className={`tiles ${editing ? "editing" : ""}`}>
        {shown.map((id, i) => (
          <EditFrame key={id} editing={editing} hidden={layout.hidden.includes(id)} first={i === 0} last={i === shown.length - 1}
            onToggle={() => setDraft(toggleHidden(layout, id))}
            onMove={(dir) => setDraft({ ...layout, order: moveTile(ids, id, dir) })}>
            {tiles.get(id)}
          </EditFrame>
        ))}
        {!editing && (
          <button className="tile tile-add" onClick={() => goTo("progress")}>
            <span className="tile-add-plus">+</span>
            <span>Track a lift</span>
          </button>
        )}
      </div>
    </section>
  );
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** In edit mode: a tile with show/hide and move controls on top. Otherwise just the tile. */
function EditFrame({ editing, hidden, first, last, onToggle, onMove, children }: {
  editing: boolean; hidden: boolean; first: boolean; last: boolean; onToggle: () => void; onMove: (dir: -1 | 1) => void; children: ReactNode;
}) {
  if (!editing) return <>{children}</>;
  return (
    <div className={`tile-frame ${hidden ? "is-hidden" : ""}`}>
      {children}
      <div className="tile-controls">
        <button className="tile-ctl" onClick={() => onMove(-1)} disabled={first} aria-label="Move earlier">◀</button>
        <button className="tile-ctl" onClick={onToggle} aria-label={hidden ? "Show tile" : "Hide tile"} aria-pressed={!hidden}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
            {hidden && <path d="M3 3l18 18" />}
          </svg>
        </button>
        <button className="tile-ctl" onClick={() => onMove(1)} disabled={last} aria-label="Move later">▶</button>
      </div>
    </div>
  );
}

/** A tile is a button that opens Progress, except while editing the dashboard. */
function TileShell({ editing, className, onClick, children }: { editing?: boolean; className: string; onClick: () => void; children: ReactNode }) {
  return editing
    ? <div className={className}>{children}</div>
    : <button className={className} onClick={onClick}>{children}</button>;
}

const deltaKg = (d: number) => (d === 0 ? "same" : `${d > 0 ? "▲" : "▼"} ${formatKg(Math.abs(d))}`);

function Tile(props: { title: string; caption: string; value: string; unit: string; sub?: string; delta?: number; deltaText?: string; onClick: () => void; editing?: boolean }) {
  const cls = props.delta === undefined || props.delta === 0 ? "same" : props.delta > 0 ? "up" : "down";
  return (
    <TileShell className="tile" onClick={props.onClick} editing={props.editing}>
      <span className="tile-value">{props.value}<small> {props.unit}</small></span>
      {props.sub && <span className="muted small">{props.sub}</span>}
      {props.deltaText && <span className={`delta ${cls}`}>{props.deltaText}</span>}
      <span className="tile-title">{props.title}</span>
      <span className="tile-caption">{props.caption}</span>
    </TileShell>
  );
}

function TrendTile({ title, caption, trend, goal, empty, onClick, lowerIsNeutral, editing }: {
  title: string; caption: string; trend: Trend; goal?: number; empty: string; onClick: () => void; lowerIsNeutral?: boolean; editing?: boolean;
}) {
  const enough = trend.series.length >= 2;
  const pct = trend.changePct;
  // A falling body weight isn't "bad", so it isn't shown in red.
  const cls = pct === null || pct === 0 ? "same" : pct > 0 ? "up" : lowerIsNeutral ? "same" : "down";
  return (
    <TileShell className={`tile ${enough ? "" : "tile-empty"}`} onClick={onClick} editing={editing}>
      {enough && <Sparkline points={trend.series} />}
      {trend.latest !== null ? (
        <>
          <span className="tile-value">{trend.latest}<small> kg</small></span>
          {pct !== null && <span className={`delta ${cls}`}>{pct > 0 ? "+" : ""}{pct}%</span>}
          {goal && trend.latest < goal && <span className="muted small">Goal {goal} kg</span>}
          {goal && trend.latest >= goal && <span className="delta up">Goal reached 🎉</span>}
        </>
      ) : (
        <span className="muted small tile-empty-text">{empty}</span>
      )}
      {trend.latest !== null && !enough && <span className="muted small">{empty}</span>}
      <span className="tile-title">{title}</span>
      <span className="tile-caption">{caption}</span>
    </TileShell>
  );
}

function SleepTile({ minutes, avg7, series, onClick, editing }: {
  minutes: number | null; avg7: number | null; series: { t: number; v: number }[]; onClick: () => void; editing?: boolean;
}) {
  return (
    <TileShell className={`tile tile-sleep ${minutes === null ? "tile-empty" : ""}`} onClick={onClick} editing={editing}>
      {series.length >= 2 && <Sparkline points={series} />}
      {minutes !== null ? (
        <>
          <span className="tile-value">{formatDuration(minutes)}</span>
          {avg7 !== null && <span className="muted small">7-day avg {formatDuration(avg7)}</span>}
        </>
      ) : (
        <span className="muted small tile-empty-text"><MoonIcon size={16} /> Tap to log a night</span>
      )}
      <span className="tile-title">Time in bed</span>
      <span className="tile-caption">Latest night</span>
    </TileShell>
  );
}
