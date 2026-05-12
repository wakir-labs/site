#!/usr/bin/env node
// test-install-de-refs-hook.mjs — hermetic test for the de-refs
// pre-push hook integration (Sprint-Frontend-4 Tag-2).
//
// Five fixtures, all in temp dirs, no network, no real push:
//
//   F1 — installer is idempotent (running twice does not double-append).
//   F2 — installer co-exists with an existing gitleaks hook (the block
//        is appended below the gitleaks logic, doesn't overwrite).
//   F3 — installed hook BLOCKS a simulated push on a DE-drift fixture
//        (de page with an EN-cross-ref-to-mirror-target).
//   F4 — installed hook PASSES on a clean DE-mirror fixture.
//   F5 — --check + --uninstall round-trip leaves the hook in
//        not-installed state.
//
// Conventions:
//   - We don't invoke `git push` for real. Instead we directly exec
//     `.git/hooks/pre-push` with the same stdin shape git would
//     deliver (a single tuple line) and inspect the exit code.
//   - "Simulated gitleaks hook" is a 5-liner that reads stdin and
//     exits 0; that mimics the gitleaks template's "no leaks" path
//     without depending on gitleaks being on PATH.

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, chmodSync, cpSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, "..");

const INSTALLER = join(REPO_ROOT, "scripts", "install-de-refs-hook.sh");
const FRAGMENT = join(REPO_ROOT, "scripts", "git-hooks", "pre-push-de-refs.sh");
const LINT = join(REPO_ROOT, "scripts", "check-de-cross-refs.mjs");

assert.ok(existsSync(INSTALLER), `installer missing: ${INSTALLER}`);
assert.ok(existsSync(FRAGMENT), `fragment missing: ${FRAGMENT}`);
assert.ok(existsSync(LINT), `lint script missing: ${LINT}`);

const SIMULATED_GITLEAKS_HOOK = `#!/usr/bin/env bash
# Simulated gitleaks hook for the test. Drains the push-tuple stream
# from stdin (mimicking the real hook's \`while read\` loop) and exits 0.
set -euo pipefail
while read -r _; do :; done
echo "[pre-push] (simulated) gitleaks: clean."
exit 0
`;

const CLEAN_DE_PAGE = `---
const lang = "de";
---
<html lang="de">
<body>
  <p>Mehr dazu auf der <a href="/de/verifier/">Verifier-Seite</a>.</p>
  <p>Or <a href="/verifier/">Read in English</a>.</p>
</body>
</html>
`;

const DRIFT_DE_PAGE = `---
const lang = "de";
---
<html lang="de">
<body>
  <!-- Drift: this href routes a DE reader into the EN /verifier/ page
       instead of the DE counterpart /de/verifier/. -->
  <p>Mehr dazu auf der <a href="/verifier/">Verifier-Seite</a>.</p>
</body>
</html>
`;

// Mirrors the real Base.astro shape: dePagesAvailable stores EN-side
// paths (without the /de/ prefix), see check-de-cross-refs.mjs Step 1.
const BASE_ASTRO_SNIPPET = `---
const dePagesAvailable = new Set<string>([
  "/",
  "/verifier/",
  "/audit-trail/",
]);
---
`;

// ---------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------

function seedRepo(tmpRoot) {
  // Layout: a minimal git repo with the lint + fragment + installer
  // copied in, plus an example src/ tree. The installer and fragment
  // resolve paths via `git rev-parse --show-toplevel`, so we cp them
  // into the seeded repo rather than symlinking from REPO_ROOT.
  execFileSync("git", ["init", "-q", tmpRoot]);
  execFileSync("git", ["-C", tmpRoot, "config", "user.email", "test@example.com"]);
  execFileSync("git", ["-C", tmpRoot, "config", "user.name", "Test User"]);
  // Disable any global hooks path during tests (some dev machines
  // configure core.hooksPath globally).
  execFileSync("git", ["-C", tmpRoot, "config", "core.hooksPath", ".git/hooks"]);

  mkdirSync(join(tmpRoot, "scripts", "git-hooks"), { recursive: true });
  mkdirSync(join(tmpRoot, "src", "pages", "de"), { recursive: true });
  mkdirSync(join(tmpRoot, "src", "layouts"), { recursive: true });

  cpSync(INSTALLER, join(tmpRoot, "scripts", "install-de-refs-hook.sh"));
  cpSync(FRAGMENT, join(tmpRoot, "scripts", "git-hooks", "pre-push-de-refs.sh"));
  cpSync(LINT, join(tmpRoot, "scripts", "check-de-cross-refs.mjs"));
  chmodSync(join(tmpRoot, "scripts", "install-de-refs-hook.sh"), 0o755);
  chmodSync(join(tmpRoot, "scripts", "git-hooks", "pre-push-de-refs.sh"), 0o755);

  writeFileSync(join(tmpRoot, "src", "layouts", "Base.astro"), BASE_ASTRO_SNIPPET);
}

function seedGitleaksHook(tmpRoot) {
  const hookPath = join(tmpRoot, ".git", "hooks", "pre-push");
  writeFileSync(hookPath, SIMULATED_GITLEAKS_HOOK);
  chmodSync(hookPath, 0o755);
}

function install(tmpRoot) {
  return spawnSync("bash", [join(tmpRoot, "scripts", "install-de-refs-hook.sh")], {
    cwd: tmpRoot,
    encoding: "utf8",
  });
}

function check(tmpRoot) {
  return spawnSync("bash", [join(tmpRoot, "scripts", "install-de-refs-hook.sh"), "--check"], {
    cwd: tmpRoot,
    encoding: "utf8",
  });
}

function uninstall(tmpRoot) {
  return spawnSync("bash", [join(tmpRoot, "scripts", "install-de-refs-hook.sh"), "--uninstall"], {
    cwd: tmpRoot,
    encoding: "utf8",
  });
}

function runHook(tmpRoot) {
  // Simulate `git push` invoking the hook with a single push-tuple on
  // stdin. The exact SHAs don't matter; the gitleaks-simulator just
  // drains the line.
  return spawnSync("bash", [join(tmpRoot, ".git", "hooks", "pre-push")], {
    cwd: tmpRoot,
    input: "refs/heads/main 1111111111111111111111111111111111111111 refs/heads/main 0000000000000000000000000000000000000000\n",
    encoding: "utf8",
  });
}

// ---------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------

function fixtureF1_idempotent() {
  const tmpRoot = mkdtempSync(join(tmpdir(), "de-refs-hook-f1-"));
  try {
    seedRepo(tmpRoot);
    seedGitleaksHook(tmpRoot);
    const r1 = install(tmpRoot);
    assert.equal(r1.status, 0, `F1: first install failed: ${r1.stderr}`);
    const before = readFileSync(join(tmpRoot, ".git", "hooks", "pre-push"), "utf8");
    const r2 = install(tmpRoot);
    assert.equal(r2.status, 0, `F1: second install failed: ${r2.stderr}`);
    const after = readFileSync(join(tmpRoot, ".git", "hooks", "pre-push"), "utf8");
    assert.equal(after, before, "F1: hook was modified on second install (should be idempotent)");
    const markerCount = (after.match(/BEGIN: de-refs-check/g) || []).length;
    assert.equal(markerCount, 1, `F1: expected 1 BEGIN marker, found ${markerCount}`);
    console.log("F1 PASS — installer is idempotent.");
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
}

function fixtureF2_coexists_with_gitleaks() {
  const tmpRoot = mkdtempSync(join(tmpdir(), "de-refs-hook-f2-"));
  try {
    seedRepo(tmpRoot);
    seedGitleaksHook(tmpRoot);
    const r = install(tmpRoot);
    assert.equal(r.status, 0, `F2: install failed: ${r.stderr}`);
    const hook = readFileSync(join(tmpRoot, ".git", "hooks", "pre-push"), "utf8");
    assert.ok(hook.includes("gitleaks: clean"), "F2: gitleaks block missing");
    assert.ok(hook.includes("BEGIN: de-refs-check"), "F2: de-refs block missing");
    // Order: gitleaks must precede de-refs block (gitleaks reads stdin first).
    const gitleaksIdx = hook.indexOf("gitleaks: clean");
    const deRefsIdx = hook.indexOf("BEGIN: de-refs-check");
    assert.ok(gitleaksIdx < deRefsIdx, "F2: de-refs block must come AFTER gitleaks block");
    console.log("F2 PASS — installer co-exists with gitleaks hook, correct order.");
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
}

function fixtureF3_blocks_on_drift() {
  const tmpRoot = mkdtempSync(join(tmpdir(), "de-refs-hook-f3-"));
  try {
    seedRepo(tmpRoot);
    seedGitleaksHook(tmpRoot);
    writeFileSync(join(tmpRoot, "src", "pages", "de", "verifier.astro"), DRIFT_DE_PAGE);
    install(tmpRoot);
    const r = runHook(tmpRoot);
    assert.notEqual(r.status, 0, `F3: hook should have BLOCKED drift but exited ${r.status}\nstdout:${r.stdout}\nstderr:${r.stderr}`);
    assert.ok(
      r.stderr.includes("BLOCKED") || r.stderr.includes("drift"),
      `F3: expected BLOCKED/drift in stderr, got: ${r.stderr}`,
    );
    console.log("F3 PASS — installed hook blocks DE-cross-ref drift.");
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
}

function fixtureF4_passes_on_clean() {
  const tmpRoot = mkdtempSync(join(tmpdir(), "de-refs-hook-f4-"));
  try {
    seedRepo(tmpRoot);
    seedGitleaksHook(tmpRoot);
    writeFileSync(join(tmpRoot, "src", "pages", "de", "verifier.astro"), CLEAN_DE_PAGE);
    install(tmpRoot);
    const r = runHook(tmpRoot);
    assert.equal(r.status, 0, `F4: hook should PASS on clean fixture but exited ${r.status}\nstdout:${r.stdout}\nstderr:${r.stderr}`);
    assert.ok(
      r.stdout.includes("de-cross-ref: clean") || r.stdout.includes("OK"),
      `F4: expected clean signal in stdout, got: ${r.stdout}`,
    );
    console.log("F4 PASS — installed hook passes on clean DE mirror.");
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
}

function fixtureF5_check_and_uninstall_roundtrip() {
  const tmpRoot = mkdtempSync(join(tmpdir(), "de-refs-hook-f5-"));
  try {
    seedRepo(tmpRoot);
    seedGitleaksHook(tmpRoot);
    // --check before install: not installed → exit 1
    const c1 = check(tmpRoot);
    assert.equal(c1.status, 1, `F5: --check before install should exit 1, got ${c1.status}`);
    install(tmpRoot);
    // --check after install: installed → exit 0
    const c2 = check(tmpRoot);
    assert.equal(c2.status, 0, `F5: --check after install should exit 0, got ${c2.status}`);
    // --uninstall removes the block
    const u = uninstall(tmpRoot);
    assert.equal(u.status, 0, `F5: --uninstall failed: ${u.stderr}`);
    const hookAfter = readFileSync(join(tmpRoot, ".git", "hooks", "pre-push"), "utf8");
    assert.ok(
      !hookAfter.includes("BEGIN: de-refs-check"),
      "F5: --uninstall did not remove the BEGIN marker",
    );
    assert.ok(
      hookAfter.includes("gitleaks: clean"),
      "F5: --uninstall accidentally removed the gitleaks block",
    );
    // --check again: not installed → exit 1
    const c3 = check(tmpRoot);
    assert.equal(c3.status, 1, `F5: --check after uninstall should exit 1, got ${c3.status}`);
    console.log("F5 PASS — --check + --uninstall round-trip is correct.");
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------
// run all fixtures
// ---------------------------------------------------------------------

try {
  fixtureF1_idempotent();
  fixtureF2_coexists_with_gitleaks();
  fixtureF3_blocks_on_drift();
  fixtureF4_passes_on_clean();
  fixtureF5_check_and_uninstall_roundtrip();
  console.log("\nALL 5 FIXTURES PASSED.");
  process.exit(0);
} catch (e) {
  console.error("\nFIXTURE FAILED:");
  console.error(e.message);
  if (e.stack) console.error(e.stack);
  process.exit(1);
}
