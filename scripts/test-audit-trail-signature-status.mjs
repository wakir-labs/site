#!/usr/bin/env node
/*
 * test-audit-trail-signature-status.mjs — hermetic snapshot / shape
 * tests for the `signatureStatus` wire-up on the audit-trail sample.
 *
 * Paired-update contract with wakir-runtime
 * (`wat.verify.manifest_v2.RealManifestResult.signature_status`):
 *
 *   - Six pinned values exposed via the `SignatureStatus` union in
 *     `src/data/wakir-audit-trail-sample.ts`. This test asserts that
 *     the data sample never emits an off-contract value.
 *   - The TV-2 cohort entries carry a four-element array sourced
 *     verbatim from the Sprint-6 Tag-2 driver-mode footer
 *     `signature_status=['verified', 'verified', 'verified', 'verified']`.
 *   - The TV-3 cohort entry carries a one-element array sourced from
 *     the same driver, `signature_status=['verified']`.
 *
 * Why not Vitest / Playwright: the site repo deliberately ships
 * without a JS test runner (package.json — Astro check + site-checks
 * is the contract). This test is a pure Node ESM script that uses
 * `node:assert/strict`, runs in `astro check`-adjacent CI, and stays
 * dependency-free. When the runtime export lands and replaces the
 * build-time sample, this test moves to wrap the live export shape.
 *
 * Run: `node scripts/test-audit-trail-signature-status.mjs`
 * Exit: 0 on success, 1 on assertion failure.
 */

import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const samplePath = path.resolve(
  here,
  "..",
  "src",
  "data",
  "wakir-audit-trail-sample.ts",
);

// Tiny inline parser: we don't want to spin up a TypeScript compiler
// just for the shape check. Read the file and import the literal via
// a regex extraction of the `sampleAuditTrail` array. The data file
// is hand-curated and small (≤300 LOC) — a regex is fit-for-purpose
// here. When the file grows we'll move to `tsx` or `ts-blank-space`.
import { readFile } from "node:fs/promises";

const source = await readFile(samplePath, "utf8");

const PINNED_VALUES = new Set([
  "",
  "verified",
  "unsigned-permissive",
  "unsigned-strict",
  "mismatch",
  "structural-error",
]);

// Extract every `signatureStatus: ...` literal in the file. We only
// match arrays-of-strings and single string literals; nothing else
// is in the contract.
function extractSignatureStatusLiterals(src) {
  const literals = [];
  // Match: signatureStatus: [ ... ],  (array form)
  const arrayRe =
    /signatureStatus:\s*\[\s*((?:"[a-z-]*"\s*,?\s*)+)\s*\]/g;
  let m;
  while ((m = arrayRe.exec(src)) !== null) {
    const values = m[1]
      .split(",")
      .map((s) => s.trim().replace(/^"|"$/g, ""))
      .filter((s) => s.length > 0 || s === "");
    literals.push({ kind: "array", values });
  }
  // Match: signatureStatus: "value",  (single form)
  const scalarRe = /signatureStatus:\s*"([a-z-]*)"\s*,/g;
  while ((m = scalarRe.exec(src)) !== null) {
    literals.push({ kind: "scalar", values: [m[1]] });
  }
  return literals;
}

// Test 1: every literal in the sample uses one of the six pinned
// values. Catches typos, drift, and stray cases the runtime would
// reject.
const literals = extractSignatureStatusLiterals(source);
for (const lit of literals) {
  for (const v of lit.values) {
    assert.ok(
      PINNED_VALUES.has(v),
      `signatureStatus value "${v}" is not in the pinned six-value contract`,
    );
  }
}

// Test 2: at least the TV-2 cohort and the TV-3 entry carry an array
// of `verified`. This is the substrate the Sprint-6 Tag-2 driver-mode
// landed on; a regression in the sample would silently break the
// brand-demo path.
const arrays = literals.filter((l) => l.kind === "array");
const verifiedOnlyArrays = arrays.filter((l) =>
  l.values.every((v) => v === "verified"),
);
assert.ok(
  verifiedOnlyArrays.length >= 2,
  `expected ≥2 verified-only signatureStatus arrays in the sample, found ${verifiedOnlyArrays.length}`,
);

// Test 3: the four-hour TV-2 cohort is represented by at least one
// array of length 4, and the TV-3 cohort by at least one length-1
// array. (We don't pin per-entry id-to-length here because the file
// could legitimately re-order; we pin the cardinality contract.)
const cardinalities = arrays.map((l) => l.values.length).sort();
assert.ok(
  cardinalities.includes(1),
  `expected at least one length-1 signatureStatus array (TV-3 cohort)`,
);
assert.ok(
  cardinalities.includes(4),
  `expected at least one length-4 signatureStatus array (TV-2 cohort)`,
);

// Test 4: the `SignatureStatus` union literal in the file declares
// exactly the six pinned values. A drift here would mean the
// frontend type-system disagrees with the runtime contract.
const unionMatch = source.match(
  /export\s+type\s+SignatureStatus\s*=\s*([^;]+);/,
);
assert.ok(unionMatch, "SignatureStatus union not found in source");
const declared = (unionMatch[1].match(/"[^"]*"/g) || []).map((s) =>
  s.replace(/^"|"$/g, ""),
);
const declaredSet = new Set(declared);
assert.equal(
  declaredSet.size,
  PINNED_VALUES.size,
  `SignatureStatus union has ${declaredSet.size} distinct values, expected ${PINNED_VALUES.size}`,
);
for (const v of PINNED_VALUES) {
  assert.ok(
    declaredSet.has(v),
    `SignatureStatus union missing pinned value "${v}"`,
  );
}

// Test 5: the component file references the `SignatureStatus` import
// (catches a future refactor that accidentally drops the type
// dependency).
const componentPath = path.resolve(
  here,
  "..",
  "src",
  "components",
  "AuditTrailEntry.astro",
);
const componentSource = await readFile(componentPath, "utf8");
assert.match(
  componentSource,
  /SignatureStatus/,
  "AuditTrailEntry.astro no longer imports SignatureStatus",
);
assert.match(
  componentSource,
  /data-signature-tone/,
  "AuditTrailEntry.astro no longer emits data-signature-tone",
);
assert.match(
  componentSource,
  /data-signature-summary/,
  "AuditTrailEntry.astro no longer emits data-signature-summary",
);

// Test 6: the EN audit-trail page wires the filter `<details>` and
// the `data-signature-filter` list attribute. Catches an accidental
// drop of the filter on a future refactor.
for (const page of [
  "src/pages/audit-trail.astro",
  "src/pages/de/audit-trail.astro",
]) {
  const p = path.resolve(here, "..", page);
  const s = await readFile(p, "utf8");
  assert.match(
    s,
    /wakir-audit-trail-filter/,
    `${page} no longer contains the signature filter`,
  );
  assert.match(
    s,
    /data-signature-filter="all"/,
    `${page} no longer sets the default filter to "all"`,
  );
  assert.match(
    s,
    /name="signature-filter"/,
    `${page} no longer wires the radio group`,
  );
}

console.log(
  `[signature-status] OK — ${literals.length} signatureStatus literals checked across the sample.`,
);
console.log(
  `[signature-status] OK — SignatureStatus union covers the six pinned runtime values.`,
);
console.log(
  `[signature-status] OK — AuditTrailEntry + audit-trail pages wire the filter substrate.`,
);
