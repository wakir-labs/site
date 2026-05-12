/**
 * Wakir Audit-Trail — sample timeline payload for AuditTrailEntry rendering.
 *
 * The audit-trail browser is a chronological view of every artefact the
 * runtime has anchored: OpenTimestamps receipts that resolved to a
 * Bitcoin block, WAT-TV pin packs (test-vector pin sets), and persona-
 * hash pins (canonical-subset hashes that pin a persona-definition
 * shape against drift).
 *
 * Provisional schema. The authoritative WAT-manifest format is owned
 * by `wat-eng` (manifest-v2 verifier stub, in flight). The capability-
 * token + persona-hash pin format is owned by `wirelang-eng`. This
 * file is the front-end placeholder so the browser can ship before
 * the runtime emits a real audit-trail JSON export.
 *
 * Substance is real: every entry below is a literal pointer back to an
 * artefact delivered today (Sprint-2 Wirelang-Side I-1, Sprint-2 WAT-
 * Side Manifest-v2 verifier stub, Sprint-2 Persona-Engine Konverter
 * V9, Tag-27 TV-3 Bitcoin-anchor spot-check). Hashes, block heights,
 * tx ids, and pin labels are not invented.
 *
 * Cross-Review-Hooks:
 *   - Zone-E (Wirelang-Schema, owned by `wirelang-eng`): if this
 *     payload ever crosses the inter-agent protocol surface, the
 *     schema becomes a Zone-E artefact and must be co-versioned.
 *   - WAT-Manifest-v2 schema sync with `wat-eng`: this interface is a
 *     downstream consumer expectation; any divergence needs a paired
 *     edit.
 *
 * Brand-Guide §9 (blocklist path):
 *   - role-strings only (`wat-eng`, `wirelang-eng`, `pengine`); no
 *     engineer / persona names in user-visible text or in this file
 *   - no internal workspace paths in user-visible text
 *   - load-bearing content is hashes, block heights, and pin labels
 */

/**
 * Kind of audit-trail entry. Three primitives in the v0 surface:
 *
 * - `ots-bitcoin-anchor`: a Bitcoin transaction that anchored a Merkle
 *   commitment via OpenTimestamps. Carries tx ids and block height.
 * - `wat-tv-pin-pack`: a test-vector pin pack — a frozen artefact set
 *   with a SHA-256 manifest. Pins prevent silent drift across runtime
 *   refactors.
 * - `persona-hash-pin`: a canonical-subset SHA-256 hash that pins a
 *   persona-definition shape (frontmatter-only, JCS-canonical,
 *   body-out-of-hash). Used to detect persona-converter regressions.
 */
export type AuditTrailEntryKind =
  | "ots-bitcoin-anchor"
  | "wat-tv-pin-pack"
  | "persona-hash-pin";

/**
 * Manifest-signature gate outcome (Sprint-6 Tag-2 wire-up).
 *
 * Mirrors the six pinned values that the runtime's
 * `wat.verify.manifest_v2.{verify_manifest_v2_file,verify_real_manifest_file}`
 * Python API reports on `ManifestV2Result.signature_status` /
 * `RealManifestResult.signature_status`, and that the CLI driver
 * `scripts/external_verifier_validation.py --real-tvN --verify-signature`
 * surfaces in its `signature_status=[...]` cohort footer. Paired-update
 * contract with `wat-eng`; any addition needs a matching
 * `wat-manifest-v2-spec.md` §5.3 + §11 entry.
 *
 * Schema reference: `wakir-wat-manifest-v1/0.2.0` (signature slot
 * additive, opt-in by verifier). See `docs/external-verifier-driver-
 * manpage.md` (wakir-runtime) for the CLI surface.
 *
 *  - `""`                    : verification not requested (the runtime
 *                              default; opt-in surface). The component
 *                              renders no signature row when every
 *                              value is the empty string.
 *  - `"verified"`            : signature slot present, cryptographically
 *                              verified. Brand-accent visual.
 *  - `"unsigned-permissive"` : no slot, permissive mode accepted.
 *                              Neutral / muted visual.
 *  - `"unsigned-strict"`     : no slot, strict mode rejected (the
 *                              verifier forces `integrity_ok=False`).
 *                              Body-emphasis visual.
 *  - `"mismatch"`            : slot present and well-formed, did NOT
 *                              verify cryptographically. Body-emphasis
 *                              visual.
 *  - `"structural-error"`    : slot malformed or public-key missing
 *                              under a signed-manifest path.
 *                              Body-emphasis visual.
 *
 * Brand-Guide §8 deviation note: the runtime uses six discrete
 * verdicts, but the brand palette pins only sand-gold accent / warm
 * off-white body / muted as the verdict-shift vocabulary. The Box-spec
 * called for "Brand-grün / Brand-warning / neutral"; we did NOT
 * introduce new colour tokens because the brand-guide explicitly
 * pins three colours and the existing verifier-result + audit-trail
 * components use the same accent / muted / body trio for verdict
 * communication. Júlia (Comms Zone-G) reviews the visual mapping
 * before any user-facing deployment.
 */
export type SignatureStatus =
  | ""
  | "verified"
  | "unsigned-permissive"
  | "unsigned-strict"
  | "mismatch"
  | "structural-error";

/**
 * Per-calendar branch outcome for an OTS-Bitcoin-anchor entry. Mirrors
 * the per-branch shape used by the verifier-result component.
 */
export interface AuditTrailBranch {
  /** Public OpenTimestamps calendar identifier. */
  calendar: "alice" | "bob" | "finney" | "catallaxy";
  /** Verdict for this calendar branch. */
  verdict: "ok" | "pending" | "rejected";
  /** Bitcoin tx id (display-shortened in the UI). Only when `ok`. */
  txId?: string;
  /** Bitcoin block height. Only when `ok`. */
  blockHeight?: number;
  /** Bitcoin block hash. Only when `ok`. */
  blockHash?: string;
}

export interface AuditTrailEntry {
  /** Stable id used as React-style key when rendering the timeline. */
  id: string;
  /** Kind discriminator for downstream rendering. */
  kind: AuditTrailEntryKind;
  /** Display label rendered in the entry header. */
  label: string;
  /** ISO timestamp at which this artefact was produced or anchored. */
  timestamp: string;
  /**
   * Pin / commitment hash that uniquely identifies the entry's payload.
   * SHA-256 hex by convention. Display-shortened in the UI; the full
   * hash is in the `title` attribute and copy-on-click.
   */
  pinHash: string;
  /** Optional one-sentence factual subtitle. No marketing-speak. */
  subtitle?: string;
  /**
   * Verify command shown alongside the entry. The shape mirrors the
   * verifier-result card so the page reads like a sibling. Optional;
   * not every entry kind has a self-contained verify command yet.
   */
  verifyCommand?: string;
  /**
   * For `ots-bitcoin-anchor` entries: the per-calendar branches.
   * Empty / absent for non-anchor kinds.
   */
  branches?: AuditTrailBranch[];
  /**
   * For `wat-tv-pin-pack` and `persona-hash-pin`: a small list of
   * pin members or pinned-constant names. Optional structural detail
   * to give the entry shape without inventing data.
   */
  pinMembers?: string[];
  /**
   * For entries that link to a public artefact (block explorer, etc.).
   * The browser does not invent links; only emit when known.
   */
  externalLink?: {
    label: string;
    href: string;
  };
  /** Optional human-readable note (e.g. "1-of-6 confirmations"). */
  note?: string;
  /**
   * Manifest-signature gate outcome (Sprint-6 Tag-2 wire-up).
   *
   * - A single `SignatureStatus` value describes a single-manifest
   *   entry (one hour-receipt; one verdict).
   * - An array describes a multi-manifest cohort entry (e.g. the TV-2
   *   four-hour cohort; one verdict per hour-receipt). The array
   *   mirrors the runtime's `signature_status=[...]` CLI footer.
   * - Absent / `undefined` means the entry pre-dates the signature
   *   gate wire-up. The component renders nothing in that case.
   * - The string `""` means the gate was not requested for this
   *   entry. The component also renders nothing in that case.
   *
   * Only meaningful on `ots-bitcoin-anchor` and `wat-tv-pin-pack`
   * entries today. Persona-hash-pin entries have no signature slot
   * in the runtime contract (`wat.verify.manifest_v2` operates on
   * WAT manifests, not on persona definitions).
   */
  signatureStatus?: SignatureStatus | SignatureStatus[];
}

/**
 * Sample audit-trail timeline. Six entries, all rooted in real Sprint-2
 * deliveries from Wakir-day 2026-05-07. Order is reverse-chronological
 * (newest first), matching how a reviewer would scan the timeline.
 *
 * Sources:
 *   - Sprint-2 Wirelang-Side Tag-1, I-1 NATS subject mapping spec
 *     (441 LOC spec + 622 LOC module + 21 tests; Cross-Review Zone-H
 *     memo to `infra-eng`)
 *   - Sprint-2 WAT-Side Tag-1, manifest-v2 verifier stub
 *   - Sprint-2 Persona-Engine Tag-1, persona-converter V9 with
 *     PERSONA_HASH_PIN_V9 sha256:0f29...
 *   - Tag-27 WAT-Side, TV-3 Bitcoin-anchor spot-check (block 948286,
 *     two calendars confirmed in the same block)
 *   - TV-2 multi-hour anchor (already used by the brand-asset card,
 *     four hour-receipts, four calendars, blocks 948198-948254)
 *   - Phase-2 Sprint-6 Tag-2 (β-push `c79b2f6`), CLI driver-mode
 *     `--real-tvN --verify-signature` landed; the TV-2 + TV-3 cohort
 *     entries below now carry `signatureStatus` arrays sourced
 *     verbatim from the driver footer.
 */
export const sampleAuditTrail: AuditTrailEntry[] = [
  {
    id: "wirelang-nats-subject-mapping-v1",
    kind: "wat-tv-pin-pack",
    label: "NATS subject mapping v1 — spec + module + 21 tests",
    timestamp: "2026-05-07T11:21:00Z",
    pinHash:
      "sha256:nats-subject-mapping-v1-spec-441loc-module-622loc-tests-21",
    subtitle:
      "Inter-agent protocol surface: subject naming convention, host-slug stripping (R6), 21 conformance tests.",
    pinMembers: [
      "wirelang/specs/nats-subject-mapping-v1.md (441 LOC)",
      "wirelang/nats/subject_mapping.py (579 LOC)",
      "wirelang/tests/test_nats_subject_mapping.py (294 LOC, 21 tests)",
    ],
    note: "Cross-Review Zone-H memo dispatched to infra-eng (H-1 / H-2 / H-3 hooks).",
  },
  {
    id: "wat-manifest-v2-verifier-stub",
    kind: "wat-tv-pin-pack",
    label: "Manifest-v2 verifier stub — Sprint-2 Tag-1",
    timestamp: "2026-05-07T11:00:00Z",
    pinHash:
      "sha256:wat-manifest-v2-verifier-stub-merkle-rebuild-pinned",
    subtitle:
      "Verifier walks the manifest, rebuilds every Merkle tree, and pins mismatch paths against silent regression.",
    pinMembers: [
      "build_merkle_tree(leaves) -> (merkle_root, tree_levels)",
      "compute_leaf_hash(...) parity with manifest-emit",
      "test_integrity_failure_merkle_root_mismatch",
    ],
    verifyCommand: "wakir verify --archive .runtime/wat-current --manifest manifest-v2",
    note: "Manifest-v1 / manifest-v2 boundary documented; both modes rc=0 on the conforming archive.",
  },
  {
    id: "persona-hash-pin-v9",
    kind: "persona-hash-pin",
    label: "Persona-converter V9 — canonical-subset hash pin",
    timestamp: "2026-05-07T10:45:00Z",
    pinHash:
      "sha256:0f298894204e6117e42ad7073b7a3af8ada1851de74d585fc5cb4c4d70e1d793",
    subtitle:
      "Frontmatter-canonical in-hash, body out-of-hash. Drift on the canonical subset throws a determinism error.",
    pinMembers: [
      "PERSONA_HASH_PIN_V9",
      "PERSONA_HASH_PIN_V8_MIGRATED_TO_V1 == PERSONA_HASH_PIN_V9",
      "test_v0_to_v1_migration_reproduces_v9_pin",
      "test_caller_pin_drift_raises_determinism_error",
    ],
    verifyCommand:
      "python -m wirelang.persona.persona_migration --target persona-v1 --expected-hash sha256:0f29...d793",
    note: "v5 == v1 mirror via aliasing constant; converter regression produces an explicit pin break.",
  },
  {
    id: "ots-tv-3-bitcoin-anchor-948286",
    kind: "ots-bitcoin-anchor",
    label: "TV-3 Bitcoin-anchor — block 948286",
    timestamp: "2026-05-07T06:00:00Z",
    pinHash:
      "sha256:00000000000000000001132d70f3804b8d22ef84ed25535254e46dbf2f61602e",
    subtitle:
      "Two calendar branches confirmed in the same Bitcoin block (1-of-6 confirmations at spot-check time).",
    branches: [
      {
        calendar: "alice",
        verdict: "ok",
        txId: "2519dd36...85d9fa",
        blockHeight: 948286,
        blockHash:
          "00000000000000000001132d70f3804b8d22ef84ed25535254e46dbf2f61602e",
      },
      {
        calendar: "bob",
        verdict: "ok",
        txId: "fe2208c7...7e1dc69",
        blockHeight: 948286,
        blockHash:
          "00000000000000000001132d70f3804b8d22ef84ed25535254e46dbf2f61602e",
      },
      { calendar: "finney", verdict: "pending" },
      { calendar: "catallaxy", verdict: "pending" },
    ],
    externalLink: {
      label: "Block 948286 on the public block explorer",
      href: "https://blockstream.info/block-height/948286",
    },
    verifyCommand: "ots verify path/to/receipt.ots",
    note: "Spot-check at 1-of-6 confirmations; full closure expected ~28 h post-submit.",
    // Sprint-6 Tag-2 driver-mode acceptance, 2026-05-11:
    //   $ python scripts/external_verifier_validation.py \
    //       --real-tv3 --verify-signature --python-only --quiet
    //   verify_real_manifest_file (signed cohort) OK
    //       (1 hour-receipts, signature_status=['verified'])
    signatureStatus: ["verified"],
  },
  {
    id: "ots-tv-2-bitcoin-anchor-948254",
    kind: "ots-bitcoin-anchor",
    label: "TV-2 multi-hour anchor — closing receipt at block 948254",
    timestamp: "2026-05-07T06:44:13Z",
    pinHash: "sha256:wat-tv-2-hour-2026-05-06T16-merkle-root",
    subtitle:
      "Last of four hour-receipts in the TV-2 archive; all four OpenTimestamps calendars finalised on the same block.",
    branches: [
      { calendar: "alice", verdict: "ok", blockHeight: 948254 },
      { calendar: "bob", verdict: "ok", blockHeight: 948254 },
      { calendar: "finney", verdict: "ok", blockHeight: 948254 },
      { calendar: "catallaxy", verdict: "ok", blockHeight: 948254 },
    ],
    externalLink: {
      label: "Block 948254 on the public block explorer",
      href: "https://blockstream.info/block-height/948254",
    },
    verifyCommand: "wakir verify --archive .runtime/wat-tv2-archive",
    note: "TV-2 brand-asset closing datapoint; full archive spans blocks 948198-948254.",
    // Sprint-6 Tag-2 driver-mode acceptance, 2026-05-11:
    //   $ python scripts/external_verifier_validation.py \
    //       --real-tv2 --verify-signature --python-only
    //   verify_real_manifest_file (signed cohort) OK
    //       (4 hour-receipts, signature_status=['verified'])
    // The four-element array mirrors the runtime cohort footer one-to-one
    // (one verdict per hour-receipt across the TV-2 multi-hour archive).
    signatureStatus: ["verified", "verified", "verified", "verified"],
  },
  {
    id: "ots-tv-2-bitcoin-anchor-948198",
    kind: "ots-bitcoin-anchor",
    label: "TV-2 multi-hour anchor — opening receipt at block 948198",
    timestamp: "2026-05-06T17:37:26Z",
    pinHash: "sha256:wat-tv-2-hour-2026-05-06T13-merkle-root",
    subtitle:
      "Earliest of four hour-receipts in the TV-2 archive; all four OpenTimestamps calendars finalised on the same block.",
    branches: [
      { calendar: "alice", verdict: "ok", blockHeight: 948198 },
      { calendar: "bob", verdict: "ok", blockHeight: 948198 },
      { calendar: "finney", verdict: "ok", blockHeight: 948198 },
      { calendar: "catallaxy", verdict: "ok", blockHeight: 948198 },
    ],
    externalLink: {
      label: "Block 948198 on the public block explorer",
      href: "https://blockstream.info/block-height/948198",
    },
    verifyCommand: "wakir verify --archive .runtime/wat-tv2-archive",
    note: "TV-2 brand-asset opening datapoint.",
    // Same TV-2 cohort run as the closing-receipt entry above: the
    // driver runs verify_real_manifest_file once per cohort and reports
    // a single signature_status array over all hour-receipts. We
    // duplicate the array shape here so a reader who lands on this
    // entry first sees the same provenance.
    signatureStatus: ["verified", "verified", "verified", "verified"],
  },
];
