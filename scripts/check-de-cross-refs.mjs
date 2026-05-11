#!/usr/bin/env node
// check-de-cross-refs.mjs — lint-check for EN-DE pairing consistency.
//
// Problem: when a DE-mirror page (`src/pages/de/<slug>.astro`) links to an
// EN-only path like `/verifier/` while a DE counterpart `/de/verifier/`
// exists on disk, users on the DE side get bounced into the EN site mid-
// article. That is a pattern-inconsistency, not a 404 — the link works,
// but it routes the reader out of their language.
//
// Sprint-Frontend-3 Tag-1 fixed three such cross-refs on /de/roadmap/
// after Júlia's stage-1 micro-text memo. This script generalises the
// check so future DE mirrors don't accumulate the same drift silently.
//
// The check is intentionally narrow:
//
//   1. Source of truth for "DE counterpart exists": the `dePagesAvailable`
//      Set in `src/layouts/Base.astro`. That set is hand-maintained to
//      match `src/pages/de/`, so it doubles as the authoritative list
//      of EN paths that have a DE mirror.
//   2. Scan every `src/pages/de/*.astro` for `href="/<slug>/"` where
//      `/<slug>/` (with leading and trailing slash) is in
//      `dePagesAvailable`.
//   3. Whitelist the language-switch line — a single short anchor at
//      the end of an article like `<a href="/<slug>/">Read in English</a>`.
//      That's the deliberate EN-side exit. Everything else is drift.
//
// Exit 0 on clean. Exit 1 with a list of findings on drift.
//
// Usage:
//   node scripts/check-de-cross-refs.mjs           # check all DE pages
//   node scripts/check-de-cross-refs.mjs --quiet   # only print findings
//   node scripts/check-de-cross-refs.mjs --help
//
// Hermetic: no npm dependencies, only Node built-ins. Same pattern as
// scripts/test-audit-trail-signature-status.mjs (Sprint-6 Tag-2 wire-up).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

const args = process.argv.slice(2);
const QUIET = args.includes("--quiet");
const HELP = args.includes("--help") || args.includes("-h");

if (HELP) {
  console.log(
    `check-de-cross-refs.mjs — lint-check for EN-DE pairing consistency.

Usage:
  node scripts/check-de-cross-refs.mjs           check all DE pages
  node scripts/check-de-cross-refs.mjs --quiet   only print findings
  node scripts/check-de-cross-refs.mjs --help    this help

Scans every src/pages/de/*.astro for href="/<slug>/" where /<slug>/
has a DE mirror per src/layouts/Base.astro's dePagesAvailable Set, and
the line is not the deliberate "Read in English" language-switch.

Exit 0 on clean, exit 1 on drift.`,
  );
  process.exit(0);
}

// --- Step 1: parse dePagesAvailable from Base.astro --------------------

const BASE_PATH = join(ROOT, "src/layouts/Base.astro");
const baseSrc = readFileSync(BASE_PATH, "utf8");

// Match the `dePagesAvailable = new Set<string>([ ... ])` block. The
// values are quoted strings. We don't try to parse Astro/TypeScript;
// we just lift the string literals between the brackets that follow
// the Set declaration.
const setMatch = baseSrc.match(
  /dePagesAvailable\s*=\s*new\s+Set<string>\(\[([\s\S]*?)\]\)/,
);
if (!setMatch) {
  console.error(
    "FAIL: could not find dePagesAvailable Set in src/layouts/Base.astro",
  );
  process.exit(2);
}
const dePagesAvailable = new Set();
const stringLiteralRe = /"([^"]+)"/g;
let m;
while ((m = stringLiteralRe.exec(setMatch[1])) !== null) {
  dePagesAvailable.add(m[1]);
}
if (dePagesAvailable.size === 0) {
  console.error(
    "FAIL: dePagesAvailable parsed but came up empty — regex drift?",
  );
  process.exit(2);
}
if (!QUIET) {
  console.log(
    `dePagesAvailable: ${dePagesAvailable.size} entries`,
    `[${[...dePagesAvailable].sort().join(", ")}]`,
  );
}

// --- Step 2: enumerate DE pages ----------------------------------------

const DE_DIR = join(ROOT, "src/pages/de");
let dePages;
try {
  dePages = readdirSync(DE_DIR)
    .filter((f) => f.endsWith(".astro"))
    .map((f) => join(DE_DIR, f));
} catch (e) {
  console.error(`FAIL: cannot list ${DE_DIR}: ${e.message}`);
  process.exit(2);
}
if (dePages.length === 0) {
  console.error(`FAIL: no .astro files under ${DE_DIR}`);
  process.exit(2);
}
if (!QUIET) {
  console.log(`Scanning ${dePages.length} DE pages under src/pages/de/`);
}

// --- Step 3: scan for EN cross-refs ------------------------------------

// hrefMatch[0] = full match, hrefMatch[1] = path with slashes, e.g. /verifier/
const HREF_RE = /href="(\/[a-z0-9-]+\/)"/g;

// Language-switch whitelist: the exact pattern is a single inline anchor
// with the body text "Read in English" or close variants. We match on
// the anchor body, not the surrounding context, because the prose
// wrapping varies (one-line vs. multi-line, with/without trailing
// period). Pattern body matchers:
//   - "Read in English"
//   - "read in english" (case-insensitive fallback)
//   - "englische Lesehilfe"   (used on /de/impressum/ + /de/datenschutz/
//     where the EN page is a courtesy redirect, not a full translation)
const LANG_SWITCH_BODY_RES = [
  /<a\s+href="\/[a-z0-9-]+\/"[^>]*>\s*Read in English\s*<\/a>/i,
  /<a\s+href="\/[a-z0-9-]+\/"[^>]*>\s*englische\s+Lesehilfe\s*<\/a>/i,
];

const findings = [];

for (const pagePath of dePages) {
  const src = readFileSync(pagePath, "utf8");
  const relPath = pagePath.slice(ROOT.length + 1);
  const lines = src.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    HREF_RE.lastIndex = 0;
    let hrefMatch;
    while ((hrefMatch = HREF_RE.exec(line)) !== null) {
      const path = hrefMatch[1]; // e.g. /verifier/
      if (!dePagesAvailable.has(path)) continue;

      // Skip the language-switch whitelist: if this very line contains
      // a "Read in English" or "englische Lesehilfe" anchor, the EN-side
      // ref is the deliberate exit.
      const isLangSwitch = LANG_SWITCH_BODY_RES.some((re) => re.test(line));
      if (isLangSwitch) continue;

      // Determine what the DE counterpart would be.
      const dePath = path === "/" ? "/de/" : `/de${path}`;

      findings.push({
        file: relPath,
        line: i + 1,
        href: path,
        suggestedHref: dePath,
        excerpt: line.trim().slice(0, 120),
      });
    }
  }
}

// --- Step 4: report ----------------------------------------------------

if (findings.length === 0) {
  if (!QUIET) {
    console.log("OK: no EN-cross-ref drift on DE mirrors.");
  } else {
    console.log("OK");
  }
  process.exit(0);
}

console.error(
  `\nFAIL: ${findings.length} EN-cross-ref drift finding(s) on DE mirrors:`,
);
console.error("");
for (const f of findings) {
  console.error(`  ${f.file}:${f.line}`);
  console.error(`    href:        "${f.href}"`);
  console.error(`    should be:   "${f.suggestedHref}"`);
  console.error(`    line:        ${f.excerpt}`);
  console.error("");
}
console.error(
  "Fix: replace the EN path with the DE counterpart, unless the link is",
);
console.error(
  'a "Read in English" / "englische Lesehilfe" language-switch (whitelisted).',
);
process.exit(1);
