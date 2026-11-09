import { useState, type FormEvent } from "react";
import { useApp } from "../context";
import type { SyncStatus } from "../sync/useCloudSync";

const STATUS_TEXT: Record<SyncStatus, string> = {
  "local-only": "Saved on this device only",
  "signed-out": "Not signed in: saved on this device only",
  syncing: "Syncing…",
  synced: "All changes synced",
  offline: "Offline: changes will sync when you're back online",
  error: "Sync failed: will retry",
};

const ago = (t: number) => {
  const s = Math.round((Date.now() - t) / 1000);
  return s < 60 ? "just now" : s < 3600 ? `${Math.floor(s / 60)} min ago` : new Date(t).toLocaleTimeString();
};

/** Header button showing sync state; opens the account sheet. */
export function SyncButton({ onClick }: { onClick: () => void }) {
  const { cloud } = useApp();
  const label = cloud.email ? STATUS_TEXT[cloud.status] : "Account and sync";
  return (
    <button className={`sync-btn st-${cloud.email ? cloud.status : "signed-out"}`} onClick={onClick} aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 18a4.5 4.5 0 0 1-.5-9A6 6 0 0 1 18 8a4 4 0 0 1-.5 10z" />
        {cloud.email && cloud.status === "synced" && <path d="M9.5 13l2 2 3.5-3.5" />}
        {cloud.email && (cloud.status === "error" || cloud.status === "offline") && <path d="M12 10.5v3M12 16v.01" />}
      </svg>
      {cloud.status === "syncing" && <span className="sync-dot" />}
    </button>
  );
}

export function AccountSheet({ onClose }: { onClose: () => void }) {
  const { cloud } = useApp();
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Account and sync" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Account &amp; sync</h2>
          <button className="btn ghost" onClick={onClose}>Close</button>
        </div>
        {!cloud.configured ? (
          <p className="muted">
            Cloud sync isn't set up for this copy of the app, so your data is saved on this device only. Use Export on the
            History tab to back it up.
          </p>
        ) : cloud.email ? <SignedIn /> : <SignInForm />}
      </div>
    </div>
  );
}

function SignedIn() {
  const { cloud } = useApp();
  const [busy, setBusy] = useState(false);
  return (
    <div className="stack">
      <div className="card">
        <span className="muted small">Signed in as</span>
        <strong>{cloud.email}</strong>
        <div className={`sync-line st-${cloud.status}`}>
          {STATUS_TEXT[cloud.status]}
          {cloud.lastSyncedAt && cloud.status === "synced" && <span className="muted"> · {ago(cloud.lastSyncedAt)}</span>}
        </div>
        {cloud.status === "error" && cloud.error && <p className="error-text small">{cloud.error}</p>}
      </div>
      <p className="muted small">
        Your workouts, routines, PRs and body weight are saved to your account and kept the same on every device you sign in
        on. A workout in progress stays on the device you started it on until you finish it.
      </p>
      <div className="row">
        <button className="btn ghost danger" disabled={busy} onClick={async () => {
          if (!confirm("Sign out? Your data stays in your account and is removed from this device.")) return;
          setBusy(true);
          await cloud.signOut();
          setBusy(false);
        }}>Sign out</button>
        <button className="btn secondary grow" disabled={cloud.status === "syncing"} onClick={cloud.syncNow}>Sync now</button>
      </div>
    </div>
  );
}

function SignInForm() {
  const { cloud, state } = useApp();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hasLocal = state.workouts.length > 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const err = mode === "in" ? await cloud.signIn(email.trim(), password) : await cloud.signUp(email.trim(), password);
    setBusy(false);
    setMsg(err);
  };

  return (
    <form className="stack" onSubmit={submit}>
      <p className="muted small">
        Sign in to back up your data and use the app on more than one device.
        {hasLocal && " Workouts already on this device are added to your account."}
      </p>
      <input className="input" type="email" autoComplete="email" placeholder="Email" required value={email}
        onChange={(e) => setEmail(e.target.value)} />
      <input className="input" type="password" autoComplete={mode === "in" ? "current-password" : "new-password"}
        placeholder={mode === "in" ? "Password" : "Password (at least 6 characters)"} minLength={6} required
        value={password} onChange={(e) => setPassword(e.target.value)} />
      {msg && <p className={`small ${msg.startsWith("Check your email") ? "muted" : "error-text"}`}>{msg}</p>}
      <button className="btn primary" disabled={busy}>{busy ? "…" : mode === "in" ? "Sign in" : "Create account"}</button>
      <button type="button" className="btn ghost sm" onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(null); }}>
        {mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}
      </button>
    </form>
  );
}
