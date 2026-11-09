import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApp } from "../context";
import { NumberField } from "../components/NumberField";
import { exerciseHistory, personalRecords, weeklySummary } from "../lib/stats";

const ACCENT = "var(--accent)";
const shortDate = (t: number) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
const tooltipStyle = { background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)" };

export function ProgressView() {
  const { state, dispatch, exerciseById } = useApp();
  const used = useMemo(() => {
    const ids = new Set(state.workouts.flatMap((w) => w.exercises.map((we) => we.exerciseId)));
    return [...ids].map((id) => exerciseById(id)).filter((e) => !!e).sort((a, b) => a!.name.localeCompare(b!.name));
  }, [state.workouts, exerciseById]);
  const [exerciseId, setExerciseId] = useState<string>("");
  const selected = exerciseId || used[0]?.id || "";

  const history = useMemo(() => exerciseHistory(state.workouts, selected), [state.workouts, selected]);
  const weekly = useMemo(() => weeklySummary(state.workouts, 8), [state.workouts]);
  const prs = useMemo(() => personalRecords(state.workouts), [state.workouts]);

  const today = new Date().toISOString().slice(0, 10);
  const latestBw = state.bodyWeight[state.bodyWeight.length - 1]?.kg ?? 70;
  const [bw, setBw] = useState(latestBw);

  return (
    <section className="stack">
      <h2>Progress</h2>

      <div className="card">
        <h3>Workouts per week</h3>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={weekly.map((w) => ({ ...w, label: shortDate(w.week) }))}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} width={24} tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--surface-2)" }} />
            <Bar dataKey="workouts" name="Workouts" fill={ACCENT} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <div className="section-head">
          <h3>Exercise progress</h3>
          {used.length > 0 && (
            <select className="input compact" value={selected} onChange={(e) => setExerciseId(e.target.value)} aria-label="Exercise">
              {used.map((e) => <option key={e!.id} value={e!.id}>{e!.name}</option>)}
            </select>
          )}
        </div>
        {history.length < 2 ? (
          <p className="muted">Log this exercise in at least two workouts to see a trend.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={history.map((p) => ({ ...p, label: shortDate(p.date) }))}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis width={36} tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="best1RM" name="Est. 1RM (kg)" stroke={ACCENT} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="topWeight" name="Top set (kg)" stroke="var(--muted)" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card">
        <h3>Personal records</h3>
        {prs.length === 0 ? <p className="muted">Finish a workout to set your first records.</p> : (
          <ul className="plain">
            {prs.map((pr) => (
              <li key={pr.exerciseId} className="split">
                <span>{exerciseById(pr.exerciseId)?.name ?? "?"}</span>
                <span><strong>{pr.weight} kg × {pr.reps}</strong> <span className="muted small">≈ {pr.est1RM} 1RM</span></span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3>Body weight</h3>
        <div className="row">
          <NumberField label="Body weight in kg" value={bw} step={0.1} onChange={setBw} className="grow" />
          <button className="btn primary" onClick={() => dispatch({ type: "logBodyWeight", date: today, kg: bw })}>Log today</button>
        </div>
        {state.bodyWeight.length >= 2 && (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={state.bodyWeight.map((b) => ({ ...b, label: shortDate(new Date(b.date).getTime()) }))}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis width={36} tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="kg" name="kg" stroke={ACCENT} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
        {state.bodyWeight.length > 0 && (
          <ul className="plain">
            {[...state.bodyWeight].reverse().slice(0, 5).map((b) => (
              <li key={b.date} className="split">
                <span className="muted">{b.date}</span>
                <span>{b.kg} kg <button className="x" aria-label={`Delete ${b.date}`} onClick={() => dispatch({ type: "deleteBodyWeight", date: b.date })}>×</button></span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
