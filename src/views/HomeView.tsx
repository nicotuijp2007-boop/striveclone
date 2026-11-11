import { useMemo } from "react";
import { useApp } from "../context";
import { WeekChecks } from "../components/ActivityCalendar";
import { Sparkline } from "../components/Sparkline";
import { e1rmPoints, formatKg, trendOver, weekReport, type Trend } from "../lib/stats";

const DAYS = 90;

/** The first screen: start training quickly and see everything you track at a glance. */
export function HomeView({ goTo }: { goTo: (tab: "workout" | "progress" | "routines") => void }) {
  const { state, dispatch, exerciseById } = useApp();

  const tiles = useMemo(
    () => state.trackedPRs.map((t) => ({
      key: t.exerciseId,
      title: exerciseById(t.exerciseId)?.name ?? "Unknown exercise",
      caption: "Est. 1RM · last 3 months",
      trend: trendOver(e1rmPoints(state.workouts, state.manualPRs, t.exerciseId), DAYS),
      goal: t.goalKg,
    })),
    [state.trackedPRs, state.workouts, state.manualPRs, exerciseById]
  );
  const weight = useMemo(
    () => trendOver(state.bodyWeight.map((b) => ({ t: new Date(`${b.date}T12:00:00`).getTime(), v: b.kg })), DAYS),
    [state.bodyWeight]
  );
  const week = useMemo(() => weekReport(state.workouts, state.manualPRs), [state.workouts, state.manualPRs]);

  const start = (routineId?: string) => {
    dispatch({ type: "startWorkout", routineId });
    goTo("workout");
  };

  return (
    <section className="stack">
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

      <div className="tiles">
        <Tile title="This week" caption="Volume vs last week"
          value={`${week.thisWeek.workouts}`} unit={week.thisWeek.workouts === 1 ? "workout" : "workouts"}
          sub={`${formatKg(week.thisWeek.volume)} volume`}
          delta={week.thisWeek.volume - week.lastWeek.volume} deltaText={deltaKg(week.thisWeek.volume - week.lastWeek.volume)}
          onClick={() => goTo("progress")} />
        <TrendTile title="Body weight" caption="Last 3 months" trend={weight} empty="Log your weight on Progress"
          onClick={() => goTo("progress")} lowerIsNeutral />
        {tiles.map((t) => (
          <TrendTile key={t.key} title={t.title} caption={t.caption} trend={t.trend} goal={t.goal}
            empty="Not enough data yet" onClick={() => goTo("progress")} />
        ))}
        <button className="tile tile-add" onClick={() => goTo("progress")}>
          <span className="tile-add-plus">+</span>
          <span>Track a lift</span>
        </button>
      </div>
    </section>
  );
}

const deltaKg = (d: number) => (d === 0 ? "same" : `${d > 0 ? "▲" : "▼"} ${formatKg(Math.abs(d))}`);

function Tile(props: { title: string; caption: string; value: string; unit: string; sub?: string; delta?: number; deltaText?: string; onClick: () => void }) {
  const cls = props.delta === undefined || props.delta === 0 ? "same" : props.delta > 0 ? "up" : "down";
  return (
    <button className="tile" onClick={props.onClick}>
      <span className="tile-value">{props.value}<small> {props.unit}</small></span>
      {props.sub && <span className="muted small">{props.sub}</span>}
      {props.deltaText && <span className={`delta ${cls}`}>{props.deltaText}</span>}
      <span className="tile-title">{props.title}</span>
      <span className="tile-caption">{props.caption}</span>
    </button>
  );
}

function TrendTile({ title, caption, trend, goal, empty, onClick, lowerIsNeutral }: {
  title: string; caption: string; trend: Trend; goal?: number; empty: string; onClick: () => void; lowerIsNeutral?: boolean;
}) {
  const enough = trend.series.length >= 2;
  const pct = trend.changePct;
  // A falling body weight isn't "bad", so it isn't shown in red.
  const cls = pct === null || pct === 0 ? "same" : pct > 0 ? "up" : lowerIsNeutral ? "same" : "down";
  return (
    <button className={`tile ${enough ? "" : "tile-empty"}`} onClick={onClick}>
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
    </button>
  );
}
