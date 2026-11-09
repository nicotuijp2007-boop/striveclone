export interface IntervalConfig {
  work: number; // seconds
  rest: number;
  rounds: number;
  prep: number;
}

export type Phase = "prep" | "work" | "rest" | "done";

export interface IntervalStatus {
  phase: Phase;
  round: number; // 1-based, 0 during prep
  remaining: number; // seconds left in the current phase
  phaseLength: number;
}

export const totalDuration = (c: IntervalConfig): number =>
  c.prep + c.rounds * c.work + Math.max(0, c.rounds - 1) * c.rest;

/** Where an interval session is after `elapsed` seconds. No rest after the final round. */
export function intervalStatus(c: IntervalConfig, elapsed: number): IntervalStatus {
  let t = elapsed;
  if (t < c.prep) return { phase: "prep", round: 0, remaining: c.prep - t, phaseLength: c.prep };
  t -= c.prep;
  for (let r = 1; r <= c.rounds; r++) {
    if (t < c.work) return { phase: "work", round: r, remaining: c.work - t, phaseLength: c.work };
    t -= c.work;
    if (r === c.rounds) break;
    if (t < c.rest) return { phase: "rest", round: r, remaining: c.rest - t, phaseLength: c.rest };
    t -= c.rest;
  }
  return { phase: "done", round: c.rounds, remaining: 0, phaseLength: 0 };
}
