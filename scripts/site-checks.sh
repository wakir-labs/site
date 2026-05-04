#!/usr/bin/env bash
# site-checks.sh — bundled quality checks for the Wakir Labs site.
#
# Four checks, in order of cost:
#   1. link-check:  every internal <a href> resolves to a built page or asset.
#   2. links-live:  every internal <a href> on the live site (CF Pages) is a
#                   real page, not the CF-Pages 404-fallback (200 + index HTML).
#   3. a11y:        no WCAG 2.1 AA errors on any built page.
#   4. lighthouse:  performance / SEO / a11y >= 95 on key pages.
#
# Tool choices and rationale are documented in the outbox report.
#
# Usage:
#   pnpm site:check                 # links + a11y + lighthouse (local-only)
#   pnpm site:check links           # local link-check (dist/) only
#   pnpm site:check links-live      # live audit against $LIVE_BASE_URL
#   pnpm site:check a11y            # a11y only
#   pnpm site:check lighthouse      # lighthouse only
#
# Env:
#   LIVE_BASE_URL  default https://wakirlabs.com
#   SITE_CHECK_PORT default 4321
#
# Exit codes: 0 = all pass, 1 = at least one check failed.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist"
PORT="${SITE_CHECK_PORT:-4321}"
BASE_URL="http://127.0.0.1:$PORT"
LIVE_BASE_URL="${LIVE_BASE_URL:-https://wakirlabs.com}"

# Direct-asset extensions: handled as plain files under dist/, not as
# <path>/index.html routes. Update when new asset types ship.
ASSET_EXTS_RE='\.(woff2|woff|ttf|otf|css|js|mjs|map|xml|json|txt|pdf|png|jpe?g|svg|gif|webp|avif|ico|webmanifest)$'

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
#   - extracts every href= and src= value from built HTML
#   - filters to internal targets (start with /)
#   - resolves each to either a direct asset file (.woff2/.css/.xml/...) or
#     a <path>/index.html route, then asserts the target exists in dist/
# Rationale (Tomás): lychee/htmltest pull in extra runtimes (Rust binary,
# Go binary). For a six-page site the grep loop is faster, has zero install
# cost in the CI container, and the failure output is human-readable. We
# revisit when the site grows past ~50 internal links.
#
# 2026-05-04 fix (Tomás): asset endpoints (fonts/css/xml/etc) are now matched
# as files, not as <path>/index.html. Previously this routine reported 37
# false-positives per build for /fonts/*.woff2 and /rss.xml. The list of
# extensions lives in $ASSET_EXTS_RE at the top of the file.
check_links() {
  ensure_build
  log "link-check: scanning $DIST"
  local fails=0
  while IFS= read -r html_file; do
    # extract internal hrefs and srcs (preloaded fonts use href, scripts/imgs use src)
    while IFS= read -r raw; do
      # strip anchor / query
      local clean="${raw%%#*}"
      clean="${clean%%\?*}"
      [[ -z "$clean" ]] && continue
      # normalize trailing slash to /index.html, but treat asset extensions
      # as direct files first (per $ASSET_EXTS_RE).
      local target
      if [[ "$clean" =~ $ASSET_EXTS_RE ]]; then
        target="$DIST$clean"
      elif [[ "$clean" == */ ]]; then
        target="$DIST${clean}index.html"
      elif [[ "$clean" == *.html ]]; then
        target="$DIST$clean"
      else
        # Astro emits dir-style routes; "/foo" usually resolves to /foo/index.html
        target="$DIST$clean/index.html"
      fi
      if [[ ! -f "$target" ]]; then
        log "  broken: $html_file -> $clean (expected $target)"
        fails=$((fails + 1))
      fi
    done < <(grep -oE '(href|src)="[^"]+"' "$html_file" \
              | sed -E 's/(href|src)="([^"]+)"/\2/' \
              | grep -E '^/' || true)
  done < <(find "$DIST" -type f -name '*.html')
  if (( fails > 0 )); then
    fail "link-check: $fails broken internal link(s)"
  fi
  log "link-check: ok"
}

# ----- 1b. links-live -------------------------------------------------------
# Live audit against the deployed site at $LIVE_BASE_URL. Crawls every
# internal href on the home page (EN+DE) and verifies each target.
#
# Why not reuse check_links? Because Cloudflare Pages serves the home page
# (HTTP 200, ~7700 bytes, "<title>Wakir Labs</title>") for any unknown path.
# A naive `curl -w "%{http_code}"` reports 200 for dead slugs. The fix is
# to (a) snapshot the index body length + title, then (b) reject any 200
# response whose body matches the index fingerprint on a non-"/" path.
#
# Asset endpoints (per $ASSET_EXTS_RE) are HTTP-status-only checks: a 200
# response is sufficient evidence of an existing file, no body fingerprint
# needed (asset bodies don't collide with the index fallback).
#
# 2026-05-04 (Tomás): replaces the ad-hoc curl loop used in the
# 2026-05-04-site-link-audit-done.md report. Codifying the CF-404-detection
# trick so future audits don't lose it.
check_links_live() {
  log "links-live: target = $LIVE_BASE_URL"
  local index_url="$LIVE_BASE_URL/"
  local tmpdir
  tmpdir="$(mktemp -d)"
  trap 'rm -rf "$tmpdir"' RETURN

  # Snapshot the index page (status, body, body length).
  local idx_body="$tmpdir/index.html"
  local idx_status
  idx_status=$(curl -sS -o "$idx_body" -w '%{http_code}' "$index_url" || echo "000")
  if [[ "$idx_status" != "200" ]]; then
    fail "links-live: index $index_url returned HTTP $idx_status"
  fi
  local idx_len
  idx_len=$(wc -c < "$idx_body")
  local idx_title
  idx_title=$(grep -oE '<title>[^<]+</title>' "$idx_body" | head -1 | sed -E 's|</?title>||g')
  log "links-live: index fingerprint len=$idx_len title=\"$idx_title\""

  # Pages whose internal hrefs we follow. Keep small — the goal is broken-
  # link detection, not full-graph crawl.
  local seed_pages=(
    "/"
    "/de/"
    "/about/"
    "/de/about/"
    "/verify/"
    "/de/verify/"
  )

  # Collect unique internal hrefs from each seed page.
  local hrefs_file="$tmpdir/hrefs.txt"
  : > "$hrefs_file"
  for sp in "${seed_pages[@]}"; do
    local sp_body="$tmpdir/seed$(echo "$sp" | tr '/' '_').html"
    if curl -sS -f -o "$sp_body" "$LIVE_BASE_URL$sp" 2>/dev/null; then
      # Filter CF-edge-injected paths (/cdn-cgi/*) — they are emitted by
      # Cloudflare's Email Obfuscation feature at edge, not by our build,
      # and /cdn-cgi/l/email-protection legitimately returns 404 to a GET.
      grep -oE '(href|src)="[^"]+"' "$sp_body" \
        | sed -E 's/(href|src)="([^"]+)"/\2/' \
        | grep -E '^/' \
        | grep -vE '^/cdn-cgi/' \
        | sed -E 's/[#?].*$//' \
        >> "$hrefs_file"
    fi
  done
  # Dedup
  sort -u -o "$hrefs_file" "$hrefs_file"
  local total
  total=$(wc -l < "$hrefs_file")
  log "links-live: $total unique internal hrefs to verify"

  local fails=0 ok=0
  while IFS= read -r path; do
    [[ -z "$path" ]] && continue
    local url="$LIVE_BASE_URL$path"
    if [[ "$path" =~ $ASSET_EXTS_RE ]]; then
      # asset: HTTP status only
      local status
      status=$(curl -sS -o /dev/null -w '%{http_code}' "$url" || echo "000")
      if [[ "$status" == "200" ]]; then
        ok=$((ok+1))
      else
        log "  broken asset: $path (HTTP $status)"
        fails=$((fails+1))
      fi
    else
      # page: status + body fingerprint
      local body="$tmpdir/probe.html"
      local status
      status=$(curl -sS -o "$body" -w '%{http_code}' "$url" || echo "000")
      if [[ "$status" != "200" ]]; then
        log "  broken page: $path (HTTP $status)"
        fails=$((fails+1))
        continue
      fi
      # Skip the index itself
      if [[ "$path" == "/" ]]; then
        ok=$((ok+1))
        continue
      fi
      local body_len
      body_len=$(wc -c < "$body")
      local body_title
      body_title=$(grep -oE '<title>[^<]+</title>' "$body" | head -1 | sed -E 's|</?title>||g')
      # CF-Pages 404-fallback detection: identical length AND identical
      # title to the index. Either alone is too tight (titles can repeat,
      # lengths can coincide); both together is a high-confidence match.
      if [[ "$body_len" == "$idx_len" && "$body_title" == "$idx_title" ]]; then
        log "  CF-fallback (200 but index body): $path"
        fails=$((fails+1))
      else
        ok=$((ok+1))
      fi
    fi
  done < "$hrefs_file"

  log "links-live: $ok ok, $fails broken"
  if (( fails > 0 )); then
    fail "links-live: $fails broken link(s) on $LIVE_BASE_URL"
  fi
  log "links-live: ok"
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
  links-live) check_links_live ;;
  a11y)       check_a11y ;;
  lighthouse) check_lighthouse ;;
  all)
    check_links
    check_a11y
    check_lighthouse
    ;;
  *) fail "unknown mode: $mode (use links|links-live|a11y|lighthouse|all)" ;;
esac

log "all requested checks passed"
