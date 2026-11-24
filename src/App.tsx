import { lazy, Suspense, useEffect, useState } from "react";
import { useApp } from "./context";
import { RestBar } from "./components/RestBar";
import { SettingsButton } from "./components/AccountSection";
import { SettingsView } from "./views/SettingsView";
import { useTheme, useWakeLock } from "./lib/device";
import { WorkoutView } from "./views/WorkoutView";
import { RoutinesView } from "./views/RoutinesView";
import { HistoryView } from "./views/HistoryView";
import { HomeView } from "./views/HomeView";
import { SleepView } from "./views/SleepView";

// Charts are heavy; load them only when the Progress tab opens.
const ProgressView = lazy(() => import("./views/ProgressView").then((m) => ({ default: m.ProgressView })));

type Tab = "home" | "workout" | "routines" | "history" | "progress" | "sleep";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10" },
  { id: "workout", label: "Workout", icon: "M6 9v6M18 9v6M3 11v2M21 11v2M6 12h12" },
  { id: "routines", label: "Routines", icon: "M5 6h14M5 12h14M5 18h9" },
  { id: "history", label: "History", icon: "M12 7v5l3 2M3 12a9 9 0 1 0 3-6.7M3 4v4h4" },
  { id: "progress", label: "Progress", icon: "M4 19V5M4 19h16M8 15l4-4 3 3 5-6" },
  { id: "sleep", label: "Sleep", icon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" },
];

export default function App() {
  const { state } = useApp();
  const [tab, setTab] = useState<Tab>("home");
  const [settings, setSettings] = useState(false);
  useTheme(state.settings.theme);
  useWakeLock(!!state.active && state.settings.keepAwake);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [settings]);

  // Sleep tracking off: no Sleep tab (and leave it if it was open).
  const sleepOn = state.settings.sleepTracking;
  const tabs = sleepOn ? TABS : TABS.filter((t) => t.id !== "sleep");
  useEffect(() => {
    if (!sleepOn && tab === "sleep") setTab("home");
  }, [sleepOn, tab]);

  const go = (t: Tab) => {
    setSettings(false);
    setTab(t);
  };

  return (
    <div className="app">
      <header className="top">
        <span className="brand">Liftlog</span>
        {state.active && (tab !== "workout" || settings) && (
          <button className="pill" onClick={() => go("workout")}>● Workout in progress</button>
        )}
        <SettingsButton open={settings} onClick={() => setSettings(!settings)} />
      </header>
      <main>
        {settings && <SettingsView onClose={() => setSettings(false)} />}
        {!settings && tab === "home" && <HomeView goTo={go} />}
        {!settings && tab === "workout" && <WorkoutView goTo={go} />}
        {!settings && tab === "routines" && <RoutinesView onStarted={() => go("workout")} />}
        {!settings && tab === "history" && <HistoryView />}
        {!settings && tab === "sleep" && sleepOn && <SleepView />}
        {!settings && tab === "progress" && (
          <Suspense fallback={<p className="muted">Loading charts…</p>}>
            <ProgressView />
          </Suspense>
        )}
      </main>
      <RestBar />
      <nav className="tabs">
        {tabs.map((t) => (
          <button key={t.id} className={!settings && tab === t.id ? "on" : ""} onClick={() => go(t.id)} aria-current={!settings && tab === t.id ? "page" : undefined}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={t.icon} />
            </svg>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
