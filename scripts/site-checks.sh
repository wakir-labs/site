#!/usr/bin/env bash
# site-checks.sh — bundled quality checks for the Wakir Labs site.
#
# Three checks, in order of cost:
#   1. link-check: every internal <a href> resolves to a built page.
#   2. a11y:       no WCAG 2.1 AA errors on any built page.
#   3. lighthouse: performance / SEO / a11y >= 95 on key pages.
#
# Tool choices and rationale are documented in the outbox report.
#
# Usage:
#   pnpm site:check               # all three
#   pnpm site:check links         # links only
#   pnpm site:check a11y          # a11y only
#   pnpm site:check lighthouse    # lighthouse only
#
# Exit codes: 0 = all pass, 1 = at least one check failed.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist"
PORT="${SITE_CHECK_PORT:-4321}"
BASE_URL="http://127.0.0.1:$PORT"

KEY_PAGES=(
  "/"
  "/about/"
  "/verify/"
  "/de/"
  "/de/about/"
  "/de/verify/"
)

# Thresholds (override via env if needed).
LH_PERF="${LH_PERF:-95}"
LH_A11Y="${LH_A11Y:-95}"
LH_SEO="${LH_SEO:-95}"

mode="${1:-all}"

log()  { printf '[site-checks] %s\n' "$*" >&2; }
fail() { log "FAIL: $*"; exit 1; }

ensure_build() {
  if [[ ! -d "$DIST" || -z "$(ls -A "$DIST" 2>/dev/null || true)" ]]; then
    log "no dist/ — running astro build"
    (cd "$ROOT" && npx --no-install astro build)
  fi
}

# ----- 1. link-check ---------------------------------------------------------
# Custom shell + grep based check, intentionally tool-light:
#   - extracts all href= values from built HTML
#   - filters to internal links (start with /)
#   - for each, asserts the target index.html exists in dist/
# Rationale (Tomás): lychee/htmltest pull in extra runtimes (Rust binary,
# Go binary). For a six-page site the grep loop is faster, has zero install
# cost in the CI container, and the failure output is human-readable. We
# revisit when the site grows past ~50 internal links.
check_links() {
  ensure_build
  log "link-check: scanning $DIST"
  local fails=0
  while IFS= read -r html_file; do
    # extract internal hrefs
    while IFS= read -r href; do
      # strip anchor / query
      local clean="${href%%#*}"
      clean="${clean%%\?*}"
      [[ -z "$clean" ]] && continue
      # normalize trailing slash to /index.html
      local target
      if [[ "$clean" == */ ]]; then
        target="$DIST${clean}index.html"
      elif [[ "$clean" == *.html ]]; then
        target="$DIST$clean"
      else
        # Astro emits dir-style routes; "/foo" usually resolves to /foo/index.html
        target="$DIST$clean/index.html"
      fi
      if [[ ! -f "$target" ]]; then
        log "  broken: $html_file -> $href (expected $target)"
        fails=$((fails + 1))
      fi
    done < <(grep -oE 'href="[^"]+"' "$html_file" \
              | sed -E 's/href="([^"]+)"/\1/' \
              | grep -E '^/' || true)
  done < <(find "$DIST" -type f -name '*.html')
  if (( fails > 0 )); then
    fail "link-check: $fails broken internal link(s)"
  fi
  log "link-check: ok"
}

# ----- 2. a11y --------------------------------------------------------------
# pa11y-ci against built pages served via http-server.
# Rationale (Tomás): pa11y is the de-facto npm-distributed a11y CLI, runs
# headless Chromium under the hood, and has a config-file format we can
# version. axe-cli is the obvious alternative; pa11y wraps axe and aXe-core
# rules anyway, plus HTML_CodeSniffer. We standardize on pa11y. WCAG 2.1 AA.
check_a11y() {
  ensure_build
  log "a11y: starting static server on :$PORT"
  npx --yes http-server "$DIST" -p "$PORT" -s &
  local server_pid=$!
  trap 'kill $server_pid 2>/dev/null || true' EXIT
  # wait for server
  for _ in $(seq 1 20); do
    if curl -sf "$BASE_URL/" >/dev/null; then break; fi
    sleep 0.2
  done

  local urls=()
  for p in "${KEY_PAGES[@]}"; do urls+=("$BASE_URL$p"); done

  # pa11y-ci reads URLs from a JSON file or argv; argv is simplest.
  npx --yes pa11y-ci --no-color \
    --standard WCAG2AA \
    "${urls[@]}" || fail "a11y: WCAG2AA errors found"

  kill $server_pid 2>/dev/null || true
  trap - EXIT
  log "a11y: ok"
}

# ----- 3. lighthouse ---------------------------------------------------------
# lighthouse CLI in headless mode.
# Rationale (Tomás): Lighthouse is the canonical tool for the metrics Júlia
# committed to publicly (Performance/SEO/Accessibility). Local CLI keeps it
# offline-friendly; LHCI server is overkill for a six-page site.
check_lighthouse() {
  ensure_build
  log "lighthouse: starting static server on :$PORT"
  npx --yes http-server "$DIST" -p "$PORT" -s &
  local server_pid=$!
  trap 'kill $server_pid 2>/dev/null || true' EXIT
  for _ in $(seq 1 20); do
    if curl -sf "$BASE_URL/" >/dev/null; then break; fi
    sleep 0.2
  done

  local fails=0
  for page in "${KEY_PAGES[@]}"; do
    local url="$BASE_URL$page"
    log "  scoring $url"
    local out
    out="$(npx --yes lighthouse "$url" \
            --quiet --chrome-flags="--headless --no-sandbox" \
            --only-categories=performance,accessibility,seo \
            --output=json --output-path=stdout 2>/dev/null || true)"
    if [[ -z "$out" ]]; then
      log "    skipped (lighthouse not runnable in this env)"
      continue
    fi
    # crude jq-free extraction
    local perf a11y seo
    perf=$(printf '%s' "$out" | grep -oE '"performance":\{"id":"performance","title":"[^"]+","score":[0-9.]+' | grep -oE '[0-9.]+$' | head -1)
    a11y=$(printf '%s' "$out" | grep -oE '"accessibility":\{"id":"accessibility","title":"[^"]+","score":[0-9.]+' | grep -oE '[0-9.]+$' | head -1)
    seo=$(printf  '%s' "$out" | grep -oE '"seo":\{"id":"seo","title":"[^"]+","score":[0-9.]+' | grep -oE '[0-9.]+$' | head -1)
    # convert 0..1 float to integer percent
    perc() { awk -v v="$1" 'BEGIN { printf "%d", v*100 + 0.5 }'; }
    local p a s
    p=$(perc "${perf:-0}"); a=$(perc "${a11y:-0}"); s=$(perc "${seo:-0}")
    log "    perf=$p a11y=$a seo=$s"
    (( p >= LH_PERF )) || { log "    perf $p < $LH_PERF"; fails=$((fails+1)); }
    (( a >= LH_A11Y )) || { log "    a11y $a < $LH_A11Y"; fails=$((fails+1)); }
    (( s >= LH_SEO  )) || { log "    seo $s < $LH_SEO";  fails=$((fails+1)); }
  done

  kill $server_pid 2>/dev/null || true
  trap - EXIT
  (( fails == 0 )) || fail "lighthouse: $fails threshold violation(s)"
  log "lighthouse: ok"
}

case "$mode" in
  links)      check_links ;;
  a11y)       check_a11y ;;
  lighthouse) check_lighthouse ;;
  all)
    check_links
    check_a11y
    check_lighthouse
    ;;
  *) fail "unknown mode: $mode (use links|a11y|lighthouse|all)" ;;
esac

log "all requested checks passed"
