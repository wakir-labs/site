#!/usr/bin/env node
// test-check-de-cross-refs.mjs — hermetic self-test for the DE-cross-ref
// lint script.
//
// Five fixtures, exercised against the in-process lint logic:
//
//   F1 (clean):       a synthetic DE page with only DE→DE links and a
//                     legitimate "Read in English" language-switch.
//                     Expected: 0 findings.
//   F2 (drift):       same page but with one inline EN cross-ref to
//                     /verifier/ where /de/verifier/ exists.
//                     Expected: 1 finding pointing at the line.
//   F3 (whitelist):   "englische Lesehilfe" anchor — used on
//                     /de/impressum/ + /de/datenschutz/. Must be treated
//                     as a language-switch, not as drift.
//                     Expected: 0 findings.
//   F4 (drift, no-slash, Sprint-Frontend-4 Tag-3 O10):
//                     a DE page with `href="/verifier"` (no trailing
//                     slash) where /de/verifier/ exists. Must be caught
//                     as drift with the `missing trailing slash`
//                     annotation in the error output.
//                     Expected: 1 finding, exit 1, annotation present.
//   F5 (whitelist, no-slash, Sprint-Frontend-4 Tag-3 O10):
//                     a legitimate "Read in English" anchor with no
//                     trailing slash on the href. Must be whitelisted
//                     just like the trailing-slash variant.
//                     Expected: 0 findings.
//
// Hermetic: no npm dependencies. Mirrors the test-audit-trail-signature-
// status.mjs pattern (Sprint-6 Tag-2 wire-up).
//
// Strategy: spawn the lint script as a child process pointed at a
// fixture worktree built in a temp dir. The fixture mimics the minimum
// repo layout the lint script reads (Base.astro + src/pages/de/*.astro).

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCRIPT = resolve(__dirname, "check-de-cross-refs.mjs");

const BASE_ASTRO = `---
const { lang = "en" } = Astro.props;
const dePagesAvailable = new Set<string>([
  "/",
  "/about/",
  "/verify/",
  "/audit-trail/",
  "/verifier/",
  "/impressum/",
  "/datenschutz/",
]);
---
<html lang={lang}><head></head><body><slot /></body></html>
`;

const FIXTURE_CLEAN = `---
import Base from "../../layouts/Base.astro";
---
<Base lang="de">
  <p>
    Siehe <a href="/de/verifier/">die Verifier-Seite</a> und
    <a href="/de/audit-trail/">die Audit-Trail-Timeline</a>.
  </p>
  <p>
    <a href="/roadmap/">Read in English</a>.
  </p>
</Base>
`;

const FIXTURE_DRIFT = `---
import Base from "../../layouts/Base.astro";
---
<Base lang="de">
  <p>
    Siehe <a href="/verifier/">die Verifier-Seite</a> und
    <a href="/de/audit-trail/">die Audit-Trail-Timeline</a>.
  </p>
  <p>
    <a href="/roadmap/">Read in English</a>.
  </p>
</Base>
`;

const FIXTURE_WHITELIST = `---
import Base from "../../layouts/Base.astro";
---
<Base lang="de">
  <p>
    Die <a href="/impressum/">englische Lesehilfe</a> liegt parallel.
  </p>
</Base>
`;

const FIXTURE_DRIFT_NO_SLASH = `---
import Base from "../../layouts/Base.astro";
---
<Base lang="de">
  <p>
    Siehe <a href="/verifier">die Verifier-Seite</a> und
    <a href="/de/audit-trail/">die Audit-Trail-Timeline</a>.
  </p>
  <p>
    <a href="/roadmap/">Read in English</a>.
  </p>
</Base>
`;

const FIXTURE_WHITELIST_NO_SLASH = `---
import Base from "../../layouts/Base.astro";
---
<Base lang="de">
  <p>
    <a href="/roadmap">Read in English</a>.
  </p>
</Base>
`;

function setupFixtureDir(baseSrc, dePageContent, fileName = "test.astro") {
  const root = mkdtempSync(join(tmpdir(), "de-cross-ref-test-"));
  mkdirSync(join(root, "src/layouts"), { recursive: true });
  mkdirSync(join(root, "src/pages/de"), { recursive: true });
  mkdirSync(join(root, "scripts"), { recursive: true });
  writeFileSync(join(root, "src/layouts/Base.astro"), baseSrc);
  writeFileSync(join(root, "src/pages/de", fileName), dePageContent);
  // Copy the lint script into the fixture so it resolves ROOT correctly
  // (the script does `resolve(__dirname, "..")` from its location).
  const linterSrc = execFileSync("cat", [SCRIPT]).toString();
  writeFileSync(join(root, "scripts/check-de-cross-refs.mjs"), linterSrc);
  return root;
}

function runLinter(root) {
  try {
    const stdout = execFileSync(
      "node",
      [join(root, "scripts/check-de-cross-refs.mjs"), "--quiet"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    return { code: 0, stdout, stderr: "" };
  } catch (e) {
    return {
      code: e.status ?? 1,
      stdout: (e.stdout ?? "").toString(),
      stderr: (e.stderr ?? "").toString(),
    };
  }
}

// --- F1: clean fixture --------------------------------------------------
{
  const root = setupFixtureDir(BASE_ASTRO, FIXTURE_CLEAN);
  const r = runLinter(root);
  assert.equal(r.code, 0, `F1 clean: expected exit 0, got ${r.code}.\nstderr: ${r.stderr}`);
  assert.match(r.stdout, /OK/, "F1 clean: stdout missing OK token");
  rmSync(root, { recursive: true, force: true });
  console.log("F1 clean fixture: PASS");
}

// --- F2: drift fixture --------------------------------------------------
{
  const root = setupFixtureDir(BASE_ASTRO, FIXTURE_DRIFT);
  const r = runLinter(root);
  assert.equal(r.code, 1, `F2 drift: expected exit 1, got ${r.code}.\nstderr: ${r.stderr}`);
  assert.match(r.stderr, /FAIL: 1 EN-cross-ref drift finding/, "F2 drift: stderr missing finding count");
  assert.match(r.stderr, /"\/verifier\/"/, "F2 drift: stderr missing /verifier/ href");
  assert.match(r.stderr, /"\/de\/verifier\/"/, "F2 drift: stderr missing /de/verifier/ suggestion");
  rmSync(root, { recursive: true, force: true });
  console.log("F2 drift fixture: PASS (1 finding caught)");
}

// --- F3: englische Lesehilfe whitelist ---------------------------------
{
  const root = setupFixtureDir(BASE_ASTRO, FIXTURE_WHITELIST);
  const r = runLinter(root);
  assert.equal(r.code, 0, `F3 whitelist: expected exit 0, got ${r.code}.\nstderr: ${r.stderr}`);
  rmSync(root, { recursive: true, force: true });
  console.log("F3 englische Lesehilfe whitelist: PASS");
}

// --- F4: drift no-slash (Sprint-Frontend-4 Tag-3 O10) ------------------
{
  const root = setupFixtureDir(BASE_ASTRO, FIXTURE_DRIFT_NO_SLASH);
  const r = runLinter(root);
  assert.equal(
    r.code,
    1,
    `F4 drift no-slash: expected exit 1, got ${r.code}.\nstderr: ${r.stderr}`,
  );
  assert.match(
    r.stderr,
    /FAIL: 1 EN-cross-ref drift finding/,
    "F4 drift no-slash: stderr missing finding count",
  );
  assert.match(
    r.stderr,
    /"\/verifier"/,
    "F4 drift no-slash: stderr missing observed href /verifier (no slash)",
  );
  assert.match(
    r.stderr,
    /missing trailing slash/,
    "F4 drift no-slash: stderr missing trailing-slash annotation",
  );
  assert.match(
    r.stderr,
    /"\/de\/verifier\/"/,
    "F4 drift no-slash: stderr missing /de/verifier/ suggestion (normalised)",
  );
  rmSync(root, { recursive: true, force: true });
  console.log("F4 drift no-slash fixture: PASS (1 finding caught, annotation present)");
}

// --- F5: whitelist no-slash (Sprint-Frontend-4 Tag-3 O10) --------------
{
  const root = setupFixtureDir(BASE_ASTRO, FIXTURE_WHITELIST_NO_SLASH);
  const r = runLinter(root);
  assert.equal(
    r.code,
    0,
    `F5 whitelist no-slash: expected exit 0, got ${r.code}.\nstderr: ${r.stderr}`,
  );
  rmSync(root, { recursive: true, force: true });
  console.log("F5 whitelist no-slash (Read in English without slash): PASS");
}

console.log("\nAll five fixtures pass.");
