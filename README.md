# Liftlog

A mobile-first fitness tracker built as an installable web app (PWA). All data is stored on the device in `localStorage`. There is no account or server.

## Features

- **Workout logging**: start an empty workout or one from a routine, then log weight and reps per set and tick sets off. New sets are prefilled from the last time you did that exercise. Only ticked sets are saved.
- **Routines**: reusable templates (exercises × sets × reps @ weight) that you can create, edit and reorder. Any finished workout can be saved as a routine.
- **Tracked PRs**: choose the lifts you care about, set an optional goal (estimated 1RM), and enter PRs set before you used the app. Ticking a set that beats a tracked PR shows a "New PR!" alert.
- **Progress**: workouts per week, estimated 1RM trend per exercise (Epley), personal records, and a body-weight log with a chart.
- **Timers**: a rest timer that starts automatically when you tick off a set and stays visible on every tab, plus an interval timer with Tabata, HIIT and EMOM presets. Both beep and vibrate.
- **History**: past workouts with duration and volume, plus JSON export and import for backups.
- Works offline once loaded, and can be installed to the home screen.

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
  context.tsx       React provider, rest-timer state
  lib/              stats, interval-timer maths, audio, default exercises
  components/       exercise picker, rest bar, numeric input
  views/            Workout, Routines, History, Progress, Timers
public/             manifest, service worker, icon
```
