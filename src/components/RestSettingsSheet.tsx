import { useApp } from "../context";
import { beep, formatClock } from "../lib/audio";

const DURATIONS = [30, 60, 90, 120, 180];

/** Rest timer length and auto-start, opened from the active workout. */
export function RestSettingsSheet({ onClose }: { onClose: () => void }) {
  const { state, dispatch, rest } = useApp();
  const { restSeconds, autoRest } = state.settings;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Rest timer" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Rest timer</h2>
          <button className="btn ghost" onClick={onClose}>Close</button>
        </div>
        <div className="chips">
          {DURATIONS.map((s) => (
            <button key={s} className={`chip ${restSeconds === s ? "on" : ""}`}
              onClick={() => dispatch({ type: "updateSettings", patch: { restSeconds: s } })}>
              {formatClock(s)}
            </button>
          ))}
        </div>
        <label className="toggle">
          <input type="checkbox" checked={autoRest}
            onChange={(e) => dispatch({ type: "updateSettings", patch: { autoRest: e.target.checked } })} />
          Start automatically when I tick off a set
        </label>
        <button className="btn secondary" onClick={() => { beep(440, 60, 0.05); rest.start(restSeconds); onClose(); }}>
          Start {formatClock(restSeconds)} rest now
        </button>
      </div>
    </div>
  );
}
