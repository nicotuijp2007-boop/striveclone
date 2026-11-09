import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from "react";
import type { AppState, Exercise } from "./types";
import { loadState, reducer, saveState, type Action } from "./store";

interface RestTimer {
  endsAt: number | null;
  total: number;
  start: (seconds: number) => void;
  adjust: (deltaSeconds: number) => void;
  stop: () => void;
}

interface Ctx {
  state: AppState;
  dispatch: (a: Action) => void;
  exerciseById: (id: string) => Exercise | undefined;
  rest: RestTimer;
}

const AppContext = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => saveState(state), [state]);

  const exerciseMap = useMemo(() => new Map(state.exercises.map((e) => [e.id, e])), [state.exercises]);
  const exerciseById = useCallback((id: string) => exerciseMap.get(id), [exerciseMap]);

  const rest = useMemo<RestTimer>(
    () => ({
      endsAt,
      total,
      start: (s) => {
        setTotal(s);
        setEndsAt(Date.now() + s * 1000);
      },
      adjust: (d) => {
        setTotal((t) => Math.max(0, t + d));
        setEndsAt((e) => (e === null ? e : Math.max(Date.now(), e + d * 1000)));
      },
      stop: () => setEndsAt(null),
    }),
    [endsAt, total]
  );

  const value = useMemo(() => ({ state, dispatch, exerciseById, rest }), [state, exerciseById, rest]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

/** Re-render on an interval while `active` is true; returns the current time. */
export function useNow(active: boolean, ms = 250): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [active, ms]);
  return now;
}
