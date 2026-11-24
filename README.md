# Liftlog

A mobile-first fitness tracker built as an installable web app (PWA). Data is always saved on the device first, so the app works offline. With Supabase configured, signing in also backs it up and syncs it across devices.

## Features

- **Home**: the screen the app opens on. Start a routine with one tap, see this week at a glance, and tiles for everything you track: each tracked lift's estimated 1RM and body weight with a 3-month mini chart and % change.
- **Workout logging**: start an empty workout or one from a routine, then log weight and reps per set and tick sets off. New sets are prefilled from the last time you did that exercise. Only ticked sets are saved.
- **Progressive overload advice**: after each workout, every exercise gets advice for next time, using double progression (default 6–10 reps). When every working set hits the top of the range, the weight goes up by that exercise's step and reps start again at the bottom. Otherwise the weight stays and the goal is more reps. The latest session decides the step. The two before it are used to spot stagnation (three sessions without more reps) or a falling trend. A small weight decrease is only suggested when you're below the range for several sessions. The advice shows on each exercise when you start a workout and prefills the sets. While you train, the card compares your ticked sets with last time (for example "+3 reps vs last time"), so beating a plateau shows as progress straight away. You can accept it or set your own weight, which then becomes the starting point; history is never changed. Rep range, step (kg) and on/off can be set per exercise.
- **Routines**: reusable templates (exercises × sets × reps @ weight) that you can create, edit and reorder. Any finished workout can be saved as a routine.
- **This week**: workouts, sets, volume and training time compared with the same point last week, plus the PRs set this week.
- **Tracked PRs**: choose the lifts you care about, set an optional goal (estimated 1RM), and enter PRs set before you used the app. Ticking a set that beats a tracked PR shows a "New PR!" alert.
- **Progress**: a heatmap of training days over the last 36 weeks (brighter = more volume), a Mon–Sun check row for this week (×N for multiple sessions), estimated 1RM trend per exercise (Epley), personal records, and a body-weight log with a chart.
- **Form videos**: a ▶ Form button on each exercise in a workout plays a YouTube form tutorial (privacy-enhanced embed). All built-in exercises have a checked default, mostly Jeff Nippard videos (TNF for pull-ups and lat pulldowns) that start at the chapter for that exercise; you can paste your own link, remove it, or go back to the default. Choices sync across devices.
- **Rest timer**: starts automatically when you tick off a set and stays visible on every tab. Turn it off, change its length, auto-start, sound and vibration in Settings.
- **Sleep tracking (optional)**: off by default; turn it on under Settings → Sleep tracking. It adds a Sleep tab, a "Time in bed" tile on Home and, between 04:00 and 14:00, a small "Good morning! How did you sleep?" card at the top of Home (no popups or notifications) with bedtime, wake-up, a live time in bed, Save sleep and Skip. Once last night is logged or skipped the card stays away until the next morning. The Sleep tab shows last night's time in bed, bedtime and wake-up, 7- and 30-day averages, a bar chart of the last 7 nights and a history you can edit and delete from; "Log a night" adds past nights. Times use the phone's time pickers; a bedtime later than the wake-up time counts as the evening before (23:00 → 07:30 = 8h 30m). Wake-up before bedtime, more than 20 hours, a wake-up in the future and a second entry for the same night are refused. It's called time in bed, not sleep, because that's all the app knows. Each night stores full timestamps and the date of the morning it ended; that date is fixed when saved, and times are shown in the phone's current time zone (so after travelling, the clock times shift but the night stays on its date). Turning tracking off hides everything but keeps the data; "Delete sleep data" in Settings removes it. Sleep entries sync like the rest (deleted nights stay deleted; if two devices log the same night before syncing, the most recently saved one is kept). The progressive overload advice doesn't use sleep (yet).
- **Settings** (gear, top right): account and sync, rest timer, theme (System / Light / Dark), keep the screen on during a workout, whether new sets are filled in (from the progression advice or last time), and JSON export and import for backups. Settings sync across devices; the most recent change wins.
- **Dashboard editing**: tap Edit on Home to show, hide and reorder tiles and pick the chart period (1, 3, 6 or 12 months), then Done to save.
- **History**: past workouts with duration and volume.
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
- Sleep entries merge by id with the newest edit winning, deletions use `sleep:<id>` markers, and there is at most one entry per night. Older data without sleep fields loads and syncs as "no sleep data".
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
  lib/              stats, progressive overload engine, audio, default exercises and settings, dashboard layout, theme and wake lock
  components/       exercise picker, overload advice panel, form videos, rest bar, numeric input
  views/            Home, Workout, Routines, History, Progress, Settings
public/             manifest, service worker, icon
supabase/           database migration
```
