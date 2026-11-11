import { lazy, Suspense, useState } from "react";
import { useApp } from "./context";
import { RestBar } from "./components/RestBar";
import { AccountSheet, SyncButton } from "./components/AccountSheet";
import { WorkoutView } from "./views/WorkoutView";
import { RoutinesView } from "./views/RoutinesView";
import { HistoryView } from "./views/HistoryView";
import { HomeView } from "./views/HomeView";

// Charts are heavy; load them only when the Progress tab opens.
const ProgressView = lazy(() => import("./views/ProgressView").then((m) => ({ default: m.ProgressView })));

type Tab = "home" | "workout" | "routines" | "history" | "progress";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10" },
  { id: "workout", label: "Workout", icon: "M6 9v6M18 9v6M3 11v2M21 11v2M6 12h12" },
  { id: "routines", label: "Routines", icon: "M5 6h14M5 12h14M5 18h9" },
  { id: "history", label: "History", icon: "M12 7v5l3 2M3 12a9 9 0 1 0 3-6.7M3 4v4h4" },
  { id: "progress", label: "Progress", icon: "M4 19V5M4 19h16M8 15l4-4 3 3 5-6" },
];

export default function App() {
  const { state } = useApp();
  const [tab, setTab] = useState<Tab>("home");
  const [account, setAccount] = useState(false);

  return (
    <div className="app">
      <header className="top">
        <span className="brand">Liftlog</span>
        {state.active && tab !== "workout" && (
          <button className="pill" onClick={() => setTab("workout")}>● Workout in progress</button>
        )}
        <SyncButton onClick={() => setAccount(true)} />
      </header>
      <main>
        {tab === "home" && <HomeView goTo={setTab} />}
        {tab === "workout" && <WorkoutView goTo={setTab} />}
        {tab === "routines" && <RoutinesView onStarted={() => setTab("workout")} />}
        {tab === "history" && <HistoryView />}
        {tab === "progress" && (
          <Suspense fallback={<p className="muted">Loading charts…</p>}>
            <ProgressView />
          </Suspense>
        )}
      </main>
      <RestBar />
      {account && <AccountSheet onClose={() => setAccount(false)} />}
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)} aria-current={tab === t.id ? "page" : undefined}>
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
