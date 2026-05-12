/**
 * Wakir Verifier Result — sample payload for VerifierResultCard rendering.
 *
 * Provisional schema. The authoritative format is owned by `wat-eng`
 * (manifest-v2 verifier stub, in flight). This file is the front-end
 * placeholder so the component can ship before the CLI emits real JSON.
 *
 * Cross-Review-Hooks:
 *   - Zone-E (Wirelang-Schema, owned by `wirelang-eng`): if the verifier
 *     output ever crosses the inter-agent protocol surface, the schema
 *     becomes a Zone-E artefact and must be co-versioned there.
 *   - CLI-Output Schema sync with `wat-eng`: this interface is a
 *     downstream consumer expectation; any divergence needs a paired
 *     edit on both sides.
 *
 * Brand-Guide §9 (blocklist path):
 *   - role-strings only (`wat-eng`, `wirelang-eng`); no engineer names
 *   - no internal workspace paths; sample paths are illustrative-only
 *   - load-bearing content is hashes, block heights, and the verdict
 */

/**
 * Top-level verdict for a verifier run.
 *
 * - `verified`: every receipt has a Bitcoin attestation that resolved
 *   to a known block, every Merkle path checks out, and the manifest
 *   matches the snapshot.
 * - `partial`: at least one receipt is still pending (calendar
 *   aggregated but not yet anchored to a block), but nothing failed.
 * - `failed`: a receipt or Merkle proof did not check out.
 *
 * The verdict is computed by the verifier; this component only
 * renders it.
 */
export type VerifierVerdict = "verified" | "partial" | "failed";

/**
 * Per-receipt verification status, one per hour-slot in the manifest.
 *
 * `branchVerdicts` is the per-calendar status. A receipt is
 * "finalised" when every calendar branch resolved to a Bitcoin block
 * height; "pending" if at least one calendar still owes a block; and
 * "failed" if a Merkle path or commit-binding check rejected.
 */
export interface VerifierReceiptResult {
  /** UTC hour-slot identifier in the form `YYYY-MM-DDTHH`. */
  hourSlot: string;
  /** Aggregate verdict for this receipt. */
  status: "finalised" | "pending" | "failed";
  /** Per-calendar branch outcomes. */
  branchVerdicts: VerifierBranchVerdict[];
  /** Optional human-readable note (e.g. "calendar `bob` not yet aggregated"). */
  note?: string;
}

export interface VerifierBranchVerdict {
  /** Public OpenTimestamps calendar identifier. */
  calendar: "alice" | "bob" | "finney" | "catallaxy";
  /** Per-branch outcome. */
  verdict: "ok" | "pending" | "rejected";
  /** Bitcoin block height when verdict is `ok`. Absent for pending/rejected. */
  blockHeight?: number;
  /** Optional rejection reason (only set when verdict is `rejected`). */
  rejectReason?: string;
}

export interface VerifierResult {
  /** Identifier for the snapshot or archive that was verified. */
  snapshotLabel: string;
  /** ISO timestamp at which the verifier was run. */
  runAt: string;
  /** Manifest schema version the verifier consumed (e.g. "v1", "v2"). */
  manifestVersion: string;
  /** Aggregate verdict across all receipts and Merkle proofs. */
  verdict: VerifierVerdict;
  /** Number of receipts checked. */
  receiptCount: number;
  /** Number of receipts in `finalised` state. */
  finalisedCount: number;
  /** Number of receipts in `pending` state. */
  pendingCount: number;
  /** Number of receipts in `failed` state. */
  failedCount: number;
  /** Lowest finalised block height across all receipts (undefined if none). */
  blockHeightMin?: number;
  /** Highest finalised block height across all receipts (undefined if none). */
  blockHeightMax?: number;
  /** Per-receipt outcomes. */
  receipts: VerifierReceiptResult[];
  /** The `wakir verify` invocation that produced this result. */
  verifyCommand: string;
}

/**
 * Sample payload — TV-2 four-hour audit-trail run, all four calendars
 * finalised. Mirrors the TV-2 brand-asset datapoint (block heights
 * 948198–948254). Used for build-time rendering on `/verifier/` until
 * a real `wakir verify --output json` flag exists.
 */
export const sampleVerified: VerifierResult = {
  snapshotLabel: "TV-2 multi-hour audit-trail run",
  runAt: "2026-05-07T11:00:00Z",
  manifestVersion: "v2-draft",
  verdict: "verified",
  receiptCount: 4,
  finalisedCount: 4,
  pendingCount: 0,
  failedCount: 0,
  blockHeightMin: 948198,
  blockHeightMax: 948254,
  receipts: [
    {
      hourSlot: "2026-05-06T13",
      status: "finalised",
      branchVerdicts: [
        { calendar: "alice", verdict: "ok", blockHeight: 948198 },
        { calendar: "bob", verdict: "ok", blockHeight: 948198 },
        { calendar: "finney", verdict: "ok", blockHeight: 948198 },
        { calendar: "catallaxy", verdict: "ok", blockHeight: 948198 },
      ],
    },
    {
      hourSlot: "2026-05-06T14",
      status: "finalised",
      branchVerdicts: [
        { calendar: "alice", verdict: "ok", blockHeight: 948199 },
        { calendar: "bob", verdict: "ok", blockHeight: 948199 },
        { calendar: "finney", verdict: "ok", blockHeight: 948199 },
        { calendar: "catallaxy", verdict: "ok", blockHeight: 948199 },
      ],
    },
    {
      hourSlot: "2026-05-06T15",
      status: "finalised",
      branchVerdicts: [
        { calendar: "alice", verdict: "ok", blockHeight: 948223 },
        { calendar: "bob", verdict: "ok", blockHeight: 948223 },
        { calendar: "finney", verdict: "ok", blockHeight: 948223 },
        { calendar: "catallaxy", verdict: "ok", blockHeight: 948223 },
      ],
    },
    {
      hourSlot: "2026-05-06T16",
      status: "finalised",
      branchVerdicts: [
        { calendar: "alice", verdict: "ok", blockHeight: 948254 },
        { calendar: "bob", verdict: "ok", blockHeight: 948254 },
        { calendar: "finney", verdict: "ok", blockHeight: 948254 },
        { calendar: "catallaxy", verdict: "ok", blockHeight: 948254 },
      ],
    },
  ],
  verifyCommand: "wakir verify --archive .runtime/wat-tv2-archive --output json",
};

/**
 * Sample payload — partial (one calendar branch still pending). Used to
 * exercise the "partial" rendering path on the demo page so the long-tail
 * wording stays honest. The verdict downgrades automatically, no manual
 * override.
 */
export const samplePartial: VerifierResult = {
  snapshotLabel: "Hypothetical mid-run snapshot",
  runAt: "2026-05-07T11:00:00Z",
  manifestVersion: "v2-draft",
  verdict: "partial",
  receiptCount: 2,
  finalisedCount: 1,
  pendingCount: 1,
  failedCount: 0,
  blockHeightMin: 948198,
  blockHeightMax: 948198,
  receipts: [
    {
      hourSlot: "2026-05-07T09",
      status: "finalised",
      branchVerdicts: [
        { calendar: "alice", verdict: "ok", blockHeight: 948198 },
        { calendar: "bob", verdict: "ok", blockHeight: 948198 },
        { calendar: "finney", verdict: "ok", blockHeight: 948198 },
        { calendar: "catallaxy", verdict: "ok", blockHeight: 948198 },
      ],
    },
    {
      hourSlot: "2026-05-07T10",
      status: "pending",
      note: "calendar `bob` aggregated but not yet anchored",
      branchVerdicts: [
        { calendar: "alice", verdict: "ok", blockHeight: 948210 },
        { calendar: "bob", verdict: "pending" },
        { calendar: "finney", verdict: "ok", blockHeight: 948210 },
        { calendar: "catallaxy", verdict: "ok", blockHeight: 948210 },
      ],
    },
  ],
  verifyCommand: "wakir verify --archive .runtime/wat-current --output json",
};
