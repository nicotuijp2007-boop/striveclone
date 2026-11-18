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

/** Header button that opens Settings. A dot shows sync trouble or a sync in progress. */
export function SettingsButton({ onClick, open }: { onClick: () => void; open: boolean }) {
  const { cloud } = useApp();
  const trouble = !!cloud.email && (cloud.status === "error" || cloud.status === "offline");
  const label = cloud.email ? `Settings · ${STATUS_TEXT[cloud.status]}` : "Settings";
  return (
    <button className={`gear-btn ${open ? "on" : ""}`} onClick={onClick} aria-label={label} title={label} aria-pressed={open}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
      {trouble && <span className="gear-dot st-error" />}
      {cloud.email && cloud.status === "syncing" && <span className="gear-dot st-syncing" />}
    </button>
  );
}

/** Sign in, sign out and sync status, shown at the top of Settings. */
export function AccountSection() {
  const { cloud } = useApp();
  if (!cloud.configured) {
    return (
      <p className="muted small">
        Cloud sync isn't set up for this copy of the app, so your data is saved on this device only. Use Export under
        Backup below to keep a copy.
      </p>
    );
  }
  return cloud.email ? <SignedIn /> : <SignInForm />;
}

function SignedIn() {
  const { cloud } = useApp();
  const [busy, setBusy] = useState(false);
  return (
    <div className="stack">
      <div className="inset">
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
