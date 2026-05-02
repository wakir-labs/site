#!/usr/bin/env bash
# bootstrap.sh — initialize and push the site skeleton.
#
# Run from a real host shell (not the agent sandbox) once you have:
#   - GitHub CLI authenticated for the wakir-labs org (`gh auth status`)
#   - Local git configured with name + email
#   - pnpm 9.x and Node 20 LTS available (only needed if you want to
#     run `pnpm install` after the push).
#
# This script does not run `pnpm install`. After the push, clone the
# repo on a workstation, run `pnpm install`, commit the lockfile in a
# follow-up commit so CI can use --frozen-lockfile.

set -euo pipefail

cd "$(dirname "$0")"

if [ -d .git ]; then
  echo "A .git directory already exists in $(pwd). Aborting." >&2
  exit 1
fi

git init -b main
git add -A
git commit -m "chore: initial commit"
gh repo create wakir-labs/site \
  --public \
  --description "Wakir Labs publishing site (Astro + Cloudflare Pages)" \
  --source=. \
  --remote=origin \
  --push
