import { useEffect, useRef } from "react";
import { useApp, useNow } from "../context";
import { beep, formatClock } from "../lib/audio";

/** Floating rest countdown shown on every screen while a rest timer runs. */
export function RestBar() {
  const { rest } = useApp();
  const now = useNow(rest.endsAt !== null);
  const fired = useRef<number | null>(null);
  const remaining = rest.endsAt === null ? 0 : (rest.endsAt - now) / 1000;

  useEffect(() => {
    if (rest.endsAt !== null && remaining <= 0 && fired.current !== rest.endsAt) {
      fired.current = rest.endsAt;
      beep(988, 250);
      setTimeout(() => beep(1318, 350), 280);
      rest.stop();
    }
  }, [remaining, rest]);

  if (rest.endsAt === null) return null;
  const pct = rest.total > 0 ? Math.min(100, Math.max(0, (1 - remaining / rest.total) * 100)) : 0;

  return (
    <div className="rest-bar" role="timer" aria-live="off">
      <div className="rest-fill" style={{ width: `${pct}%` }} />
      <span className="rest-label">Rest</span>
      <span className="rest-time">{formatClock(remaining)}</span>
      <button className="btn ghost sm" onClick={() => rest.adjust(-15)}>−15</button>
      <button className="btn ghost sm" onClick={() => rest.adjust(15)}>+15</button>
      <button className="btn ghost sm" onClick={rest.stop}>Skip</button>
    </div>
  );
}
