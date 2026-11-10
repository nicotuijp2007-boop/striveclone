# Liftlog: notes for Claude

## Deploys are limited (free Netlify plan)

Every merge or push to `main` triggers a production deploy on Netlify, and the free plan has a monthly
credit limit (about 20 deploys); when it runs out the site is paused until the next month.

- Never push or merge to `main` unless the user explicitly asks for it in that conversation.
- Do work on a feature branch and batch changes, so one merge carries several improvements.
- When work is ready, tell the user it will cost one deploy and ask before opening a pull request into `main`.
- `scripts/netlify-ignore.sh` (wired up as `ignore` in `netlify.toml`) already skips deploy previews,
  branch deploys, and production builds where only docs, tests or the SQL migration changed. Keep it that way.

## Checks before handing work back

- `npm test` (vitest), `npm run typecheck`, `npm run build`.
