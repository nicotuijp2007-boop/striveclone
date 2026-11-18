import type { DashboardLayout } from "../types";

/**
 * Put tile ids in the saved order. Ids the layout doesn't know yet (a newly tracked lift) go at the
 * end in their natural order; saved ids that no longer exist are skipped.
 */
export function arrangeTiles(ids: string[], order: string[]): string[] {
  const present = new Set(ids);
  const known = order.filter((id) => present.has(id));
  const seen = new Set(known);
  return [...known, ...ids.filter((id) => !seen.has(id))];
}

/** Move one tile a place earlier (-1) or later (+1). */
export function moveTile(order: string[], id: string, dir: -1 | 1): string[] {
  const i = order.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return order;
  const next = [...order];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export const toggleHidden = (layout: DashboardLayout, id: string): DashboardLayout => ({
  ...layout,
  hidden: layout.hidden.includes(id) ? layout.hidden.filter((h) => h !== id) : [...layout.hidden, id],
});

export const periodDays = (months: number): number => Math.round(months * 30.44);
export const periodLabel = (months: number): string => (months === 12 ? "last year" : `last ${months} month${months === 1 ? "" : "s"}`);
