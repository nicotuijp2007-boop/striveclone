import { useEffect, useRef, useState } from "react";
import { useApp, useNow } from "../context";
import { NumberField } from "../components/NumberField";
import { beep, formatClock } from "../lib/audio";
import { intervalStatus, totalDuration, type IntervalConfig } from "../lib/interval";

const PRESETS: { name: string; cfg: IntervalConfig }[] = [
  { name: "Tabata", cfg: { work: 20, rest: 10, rounds: 8, prep: 10 } },
  { name: "HIIT 40/20", cfg: { work: 40, rest: 20, rounds: 10, prep: 10 } },
  { name: "EMOM 10", cfg: { work: 60, rest: 0, rounds: 10, prep: 10 } },
];

const PHASE_LABEL = { prep: "Get ready", work: "Work", rest: "Rest", done: "Done!" } as const;

export function TimerView() {
  const { state, dispatch, rest } = useApp();
  const [cfg, setCfg] = useState<IntervalConfig>(PRESETS[0].cfg);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [pausedElapsed, setPausedElapsed] = useState(0); // seconds accumulated before current run
  const running = startedAt !== null;
  const now = useNow(running, 100);

  const elapsed = pausedElapsed + (running ? (now - startedAt) / 1000 : 0);
  const status = intervalStatus(cfg, elapsed);
  const lastKey = useRef("");

  // Beep on phase change and on the last 3 seconds of a phase.
  useEffect(() => {
    if (!running) return;
    const secs = Math.ceil(status.remaining);
    const key = `${status.phase}-${status.round}-${secs}`;
    if (key === lastKey.current) return;
    const phaseChanged = !lastKey.current.startsWith(`${status.phase}-${status.round}-`);
    lastKey.current = key;
    if (status.phase === "done") {
      beep(660, 600);
      setStartedAt(null);
      setPausedElapsed(totalDuration(cfg));
    } else if (phaseChanged && elapsed > 0.2) {
      beep(status.phase === "work" ? 1046 : 523, 400);
    } else if (secs <= 3 && secs > 0) {
      beep(784, 120);
    }
  }, [running, status, cfg, elapsed]);

  const reset = () => { setStartedAt(null); setPausedElapsed(0); lastKey.current = ""; };
  const toggle = () => {
    if (running) {
      setPausedElapsed(elapsed);
      setStartedAt(null);
    } else {
      if (status.phase === "done") { setPausedElapsed(0); lastKey.current = ""; }
      beep(440, 60, 0.05); // unlock audio during the user gesture
      setStartedAt(Date.now());
    }
  };

  const pct = status.phaseLength ? (1 - status.remaining / status.phaseLength) * 100 : 100;
  const idle = !running && pausedElapsed === 0;

  return (
    <section className="stack">
      <h2>Interval timer</h2>
      <div className={`card timer-face phase-${status.phase}`}>
        <span className="phase">{PHASE_LABEL[status.phase]}</span>
        <span className="big-clock">{formatClock(status.remaining || (idle ? cfg.prep : 0))}</span>
        <span className="muted">
          {status.phase === "prep" ? `${cfg.rounds} rounds · ${formatClock(totalDuration(cfg))} total` : `Round ${status.round} / ${cfg.rounds}`}
        </span>
        <div className="progress"><div style={{ width: `${pct}%` }} /></div>
        <div className="row">
          <button className="btn ghost" onClick={reset} disabled={idle}>Reset</button>
          <button className="btn primary grow" onClick={toggle}>
            {running ? "Pause" : status.phase === "done" ? "Restart" : idle ? "Start" : "Resume"}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="chips">
          {PRESETS.map((p) => (
            <button key={p.name} className="chip" disabled={!idle} onClick={() => setCfg(p.cfg)}>{p.name}</button>
          ))}
        </div>
        <div className="field-row">
          <label>Work (s)<NumberField label="Work seconds" value={cfg.work} min={1} onChange={(n) => idle && setCfg({ ...cfg, work: Math.round(n) || 1 })} /></label>
          <label>Rest (s)<NumberField label="Rest seconds" value={cfg.rest} onChange={(n) => idle && setCfg({ ...cfg, rest: Math.round(n) })} /></label>
          <label>Rounds<NumberField label="Rounds" value={cfg.rounds} min={1} onChange={(n) => idle && setCfg({ ...cfg, rounds: Math.max(1, Math.round(n)) })} /></label>
        </div>
      </div>

      <h2>Rest timer</h2>
      <div className="card stack">
        <div className="chips">
          {[30, 60, 90, 120, 180].map((s) => (
            <button key={s} className={`chip ${state.settings.restSeconds === s ? "on" : ""}`}
              onClick={() => dispatch({ type: "updateSettings", patch: { restSeconds: s } })}>
              {formatClock(s)}
            </button>
          ))}
        </div>
        <label className="toggle">
          <input type="checkbox" checked={state.settings.autoRest}
            onChange={(e) => dispatch({ type: "updateSettings", patch: { autoRest: e.target.checked } })} />
          Start automatically when I tick off a set
        </label>
        <button className="btn secondary" onClick={() => { beep(440, 60, 0.05); rest.start(state.settings.restSeconds); }}>
          Start {formatClock(state.settings.restSeconds)} rest now
        </button>
      </div>
    </section>
  );
}
