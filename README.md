# Liftlog

A mobile-first fitness tracker built as an installable web app (PWA). Data is always saved on the device first, so the app works offline. With Supabase configured, signing in also backs it up and syncs it across devices.

## Features

- **Workout logging**: start an empty workout or one from a routine, then log weight and reps per set and tick sets off. New sets are prefilled from the last time you did that exercise. Only ticked sets are saved.
- **Routines**: reusable templates (exercises × sets × reps @ weight) that you can create, edit and reorder. Any finished workout can be saved as a routine.
- **Tracked PRs**: choose the lifts you care about, set an optional goal (estimated 1RM), and enter PRs set before you used the app. Ticking a set that beats a tracked PR shows a "New PR!" alert.
- **Progress**: a heatmap of training days over the last 36 weeks (brighter = more volume), a Mon–Sun check row for this week (×N for multiple sessions), estimated 1RM trend per exercise (Epley), personal records, and a body-weight log with a chart.
- **Timers**: a rest timer that starts automatically when you tick off a set and stays visible on every tab, plus an interval timer with Tabata, HIIT and EMOM presets. Both beep and vibrate.
- **History**: past workouts with duration and volume, plus JSON export and import for backups.
- Works offline once loaded, and can be installed to the home screen.

## Cloud sync (Supabase)

Sync is optional. Without the settings below, the app runs local-only and hides nothing except the sign-in.

1. Create a project at [supabase.com](https://supabase.com).
2. In the dashboard's **SQL Editor**, run [`supabase/migrations/20261109000000_user_data.sql`](supabase/migrations/20261109000000_user_data.sql). It creates the `user_data` table with row-level security, so each user can only read and write their own row.
3. Copy `.env.example` to `.env.local` and fill in the **Project URL** and **anon public key** from Project Settings → API. The anon key is safe to ship in the app; row-level security is what protects the data.
4. Optional: under Authentication → Sign In / Providers → Email, turn off **Confirm email** if you don't want new accounts to confirm by email first.

How it works:

- Everything is still saved to `localStorage` immediately. When signed in, changes upload about 1.5 s later, and the app pulls when opened, when it returns to the foreground, when it comes back online, and every minute while open.
- Each user has one row: their data as JSON plus a revision number. A device only writes if it has seen the latest revision; otherwise it downloads, merges, and retries.
- Merging combines lists by id, so workouts logged offline on two devices are both kept. Deletions are remembered (`state.deleted`), so a deleted workout doesn't come back from another device.
- The workout in progress isn't synced; it stays on its device until finished.
- Signing out uploads pending changes, then clears the data from that device.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (vitest)
npm run build      # typecheck + production build in dist/
```

## Structure

```
src/
  types.ts          data model
  store.ts          reducer + localStorage persistence (pure, unit-tested)
  sync/             Supabase client, sync engine, merge logic (unit-tested with a fake cloud)
  context.tsx       React provider, rest-timer state
  lib/              stats, interval-timer maths, audio, default exercises
  components/       exercise picker, rest bar, numeric input
  views/            Workout, Routines, History, Progress, Timers
public/             manifest, service worker, icon
supabase/           database migration
```
