#!/usr/bin/env bash
# Netlify runs this before each build (see `ignore` in netlify.toml).
# Exit 0 = skip the build, exit 1 = build. On the free plan every deploy costs credits,
# so only build production when something that ends up in the app changed.

if [ "$CONTEXT" != "production" ]; then
  echo "Skipping $CONTEXT build: only the production branch deploys."
  exit 0
fi

# First build, or a manual "Trigger deploy" of the same commit: build.
if [ -z "$CACHED_COMMIT_REF" ] || [ "$CACHED_COMMIT_REF" = "$COMMIT_REF" ]; then
  exit 1
fi

# Files that affect the built app. Tests, docs and the SQL migration are left out on purpose.
if git diff --quiet "$CACHED_COMMIT_REF" "$COMMIT_REF" -- \
  src public index.html package.json package-lock.json vite.config.ts tsconfig.json netlify.toml \
  ':(exclude)*.test.ts'; then
  echo "No app changes since the last deploy: skipping build."
  exit 0
fi

# Changes found (or git couldn't compare): build.
exit 1
