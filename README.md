# Liftlog

A mobile-first fitness tracker built as an installable web app (PWA). Data is always saved on the device first, so the app works offline. With Supabase configured, signing in also backs it up and syncs it across devices.

## Features

- **Home**: the screen the app opens on. Start a routine with one tap, see this week at a glance, and tiles for everything you track: each tracked lift's estimated 1RM and body weight with a 3-month mini chart and % change.
- **Workout logging**: start an empty workout or one from a routine, then log weight and reps per set and tick sets off. New sets are prefilled from the last time you did that exercise. Only ticked sets are saved.
- **Routines**: reusable templates (exercises × sets × reps @ weight) that you can create, edit and reorder. Any finished workout can be saved as a routine.
- **This week**: workouts, sets, volume and training time compared with the same point last week, plus the PRs set this week.
- **Tracked PRs**: choose the lifts you care about, set an optional goal (estimated 1RM), and enter PRs set before you used the app. Ticking a set that beats a tracked PR shows a "New PR!" alert.
- **Progress**: a heatmap of training days over the last 36 weeks (brighter = more volume), a Mon–Sun check row for this week (×N for multiple sessions), estimated 1RM trend per exercise (Epley), personal records, and a body-weight log with a chart.
- **Form videos**: a ▶ Form button on each exercise in a workout plays a YouTube form tutorial (privacy-enhanced embed). All built-in exercises have a checked default, mostly Jeff Nippard videos (TNF for pull-ups and lat pulldowns) that start at the chapter for that exercise; you can paste your own link, remove it, or go back to the default. Choices sync across devices.
- **Rest timer**: starts automatically when you tick off a set and stays visible on every tab; set its length with the ⏱ button in a workout.
- **History**: past workouts with duration and volume, plus JSON export and import for backups.
- Works offline once loaded, and can be installed to the home screen.

## Cloud sync (Supabase)

Sync is optional. Without the settings below, the app runs local-only and the account screen says so.

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

## Deploying (Netlify)

`netlify.toml` holds the build command, Node version, Supabase settings and cache headers, so nothing needs configuring in the Netlify UI.

1. In Netlify: **Add new site → Import an existing project → GitHub**, and pick this repository.
2. Choose the branch to deploy (production deploys follow it on every push). Leave the build settings as detected.
3. After the first deploy, set the site's URL as **Site URL** in Supabase under Authentication → URL Configuration, so any emails Supabase sends link to the app.

## Scheduled job

`.github/workflows/keep-supabase-awake.yml` pings the database every Monday and Thursday so the free Supabase project isn't paused after 7 quiet days. Scheduled workflows only run from `main`, and GitHub disables them after 60 days without repository activity (re-enable under Actions if that happens).

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
