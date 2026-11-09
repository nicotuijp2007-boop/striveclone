import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { AppState } from "../types";
import type { Action } from "../store";
import { syncOnce } from "./engine";
import { supabase, supabaseStore } from "./supabase";

export type SyncStatus = "local-only" | "signed-out" | "syncing" | "synced" | "offline" | "error";

export interface CloudSync {
  configured: boolean;
  email: string | null;
  status: SyncStatus;
  lastSyncedAt: number | null;
  error: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  syncNow: () => void;
}

const cursorKey = (userId: string) => `liftlog:sync:${userId}`;
const DEBOUNCE_MS = 1500;
const POLL_MS = 60_000;

/** Keeps the app state in sync with Supabase while a user is signed in. */
export function useCloudSync(state: AppState, dispatch: (a: Action) => void): CloudSync {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SyncStatus>(supabase ? "signed-out" : "local-only");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;
  const running = useRef<Promise<void> | null>(null);
  const again = useRef(false);
  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const run = useCallback((): Promise<void> => {
    if (!supabase || !userId) return Promise.resolve();
    if (running.current) {
      again.current = true; // a change came in mid-sync: go once more afterwards
      return running.current;
    }
    const client = supabase;
    const go = async () => {
      if (!navigator.onLine) return setStatus("offline");
      setStatus("syncing");
      try {
        await syncOnce({
          remote: supabaseStore(client, userId),
          getState: () => stateRef.current,
          applyRemote: (remote) => dispatch({ type: "mergeRemote", remote }),
          loadCursor: () => {
            try { return JSON.parse(localStorage.getItem(cursorKey(userId)) ?? "null"); } catch { return null; }
          },
          saveCursor: (c) => {
            try { localStorage.setItem(cursorKey(userId), JSON.stringify(c)); } catch { /* storage unavailable */ }
          },
        });
        setStatus("synced");
        setLastSyncedAt(Date.now());
        setError(null);
      } catch (e) {
        setStatus(navigator.onLine ? "error" : "offline");
        setError(e instanceof Error ? e.message : String(e));
      }
    };
    running.current = go().finally(() => {
      running.current = null;
      if (again.current) {
        again.current = false;
        void run();
      }
    });
    return running.current;
  }, [userId, dispatch]);

  // Sync on sign-in, when the app comes back to the foreground or online, and every minute while visible.
  useEffect(() => {
    if (!userId) {
      if (supabase) setStatus("signed-out");
      return;
    }
    void run();
    const onVisible = () => document.visibilityState === "visible" && void run();
    const onOnline = () => void run();
    const onOffline = () => setStatus("offline");
    const poll = setInterval(() => document.visibilityState === "visible" && void run(), POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [userId, run]);

  // Upload shortly after local changes. The in-progress workout isn't synced, so ignore changes to it alone.
  const { active: _active, ...synced } = state;
  const syncedJson = JSON.stringify(synced);
  const firstChange = useRef(true);
  useEffect(() => {
    if (!userId) return;
    if (firstChange.current) {
      firstChange.current = false;
      return;
    }
    const t = setTimeout(() => void run(), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [syncedJson, userId, run]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return "Cloud sync isn't set up in this build.";
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) return "Cloud sync isn't set up in this build.";
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return error.message;
    return data.session ? null : "Check your email to confirm your account, then sign in.";
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await run(); // upload anything not yet synced before removing it from this device
    await supabase.auth.signOut();
    if (userId) localStorage.removeItem(cursorKey(userId));
    dispatch({ type: "reset" });
    setLastSyncedAt(null);
  }, [run, userId, dispatch]);

  const email = session?.user.email ?? null;
  return useMemo(
    () => ({ configured: !!supabase, email, status, lastSyncedAt, error, signIn, signUp, signOut, syncNow: () => void run() }),
    [email, status, lastSyncedAt, error, signIn, signUp, signOut, run]
  );
}
