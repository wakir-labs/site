# Lighthouse run — 2026-05-04 (no-browser environment)

**Status:** Lighthouse-CLI run **not executable in the dev-engineering toolbox.**
No Chromium, Chrome, or Firefox binary available; `npx lighthouse` requires
Chrome headless. Documented as anti-bullshit-honest per task brief.

## What was done instead

A static-build audit pass against the `dist/` HTML, plus targeted fixes for
the issues such an audit can catch deterministically without a runtime
browser:

1. **Color-contrast** computed offline against the WCAG 2.1 luminance formula
   for every named token pair (body/muted/accent on dark + light bg). Result
   below.
2. **OpenGraph + Twitter-Card + JSON-LD Article schema** reviewed in built
   HTML and added to the Base layout.
3. **Heading hierarchy** scanned per page (H1 → H2 → H3, no skips).
4. **`aria-current` syntax** corrected on the lang toggle (now omitted on the
   inactive item, `"page"` on the active one).
5. **Asset weights** measured — see `asset-budget.txt`.

## Color-contrast — WCAG 2.1 AA verdict

Computed locally; reproducible with `python3 contrast.py` (see source in
the report).

| Pair                                   | Ratio | AA-large | AA-normal | AAA |
|----------------------------------------|------:|:--------:|:---------:|:---:|
| dark body `#E6E4DC` on bg `#0E1014`    | 14.96 | PASS     | PASS      | PASS |
| dark muted `#9A988F` on bg             |  6.58 | PASS     | PASS      | FAIL |
| dark accent `#C8AA6A` on bg            |  8.54 | PASS     | PASS      | PASS |
| dark accent on bg-elevated `#15171C`   |  8.04 | PASS     | PASS      | PASS |
| dark btn-primary text on accent bg     |  8.54 | PASS     | PASS      | PASS |
| light body `#1A1B1F` on bg `#FAF7F0`   | 16.08 | PASS     | PASS      | PASS |
| light muted `#5A5B60` on bg            |  6.33 | PASS     | PASS      | FAIL |
| **light accent `#9A7B2E`** on bg (OLD) |  3.74 | PASS     | **FAIL**  | FAIL |
| **light accent `#7D6020`** on bg (NEW) |  5.50 | PASS     | PASS      | FAIL |
| light accent NEW on bg-elevated        |  5.08 | PASS     | PASS      | FAIL |

The light-mode accent was the only AA-normal failure and has been moved
from `#9A7B2E` to `#7D6020` in `src/styles/tokens.css`. AAA failures on
muted text are intentional — these are meta-text labels (timestamps,
read-time captions) where AA is the spec target.

## Re-run instructions when a browser is available

The repo already ships `scripts/site-checks.sh lighthouse`, which spins up
`http-server` on `dist/` and pipes URL-by-URL through `npx lighthouse`. To
run when a Chromium binary lands in the environment:

```bash
cd infra/repos-skeleton/site
npm install
npm run site:check:lighthouse
```

Output JSON ends up at `meta/lighthouse-2026-05-04/<slug>.json` if the
script is wired to write there (currently the script logs scores to
stdout — file-output flag is a follow-up if editorial wants the JSON
pinned).
