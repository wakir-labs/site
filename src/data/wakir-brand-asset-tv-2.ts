/**
 * Wakir-Brand-Asset — TV-2 Bitcoin-Anchor Datapoint
 *
 * Source: dev-engineering Tag-22 close-out (2026-05-07T06:44:13Z UTC).
 * TV-2 four hour-receipts, all four OpenTimestamps calendar branches
 * finalised on each receipt within ~13 h of submit.
 *
 * Build-time inlining (Option A from Sprint-Frontend-0 Tag-1 concept).
 * The data is human-curated against the engineering close-out memo;
 * future iterations may switch to a `wakir verify --output json` build
 * step (Option B) once the CLI flag exists.
 *
 * Brand-Guide §9 (blocklist path):
 *   - no engineer / persona names
 *   - no internal workspace paths
 *   - role-strings only ("dev-engineering", not a real name)
 *   - role-string usage is itself sparse — the asset speaks through
 *     hashes and block heights, not through attribution
 */

export interface CalendarBranchStatus {
  /** Public OpenTimestamps calendar identifier. */
  calendar: "alice" | "bob" | "finney" | "catallaxy";
  /** Bitcoin block height at which this calendar's branch was finalised. */
  blockHeight: number;
}

export interface HourReceipt {
  /** UTC hour-slot identifier in the form `YYYY-MM-DDTHH`. */
  hourSlot: string;
  /** Per-calendar branch finalisations for this receipt. 4-of-4 = all branches present. */
  branches: CalendarBranchStatus[];
}

export interface BrandAssetTv2 {
  /** Asset slug for component routing. */
  slug: "tv-2";
  /** Human-readable label rendered in the card title. */
  label: string;
  /** ISO submit timestamp (UTC). */
  submittedAt: string;
  /** ISO close-out timestamp (UTC) at which 4-of-4 was confirmed. */
  closedAt: string;
  /** Number of hour-receipts in the run. */
  receiptCount: number;
  /** Number of independent OpenTimestamps calendars used. */
  calendarCount: number;
  /** Per-receipt branch finalisations. */
  receipts: HourReceipt[];
  /** Lowest finalised block height across all receipts. */
  blockHeightMin: number;
  /** Highest finalised block height across all receipts. */
  blockHeightMax: number;
  /** Span in blocks (max - min). */
  blockHeightSpan: number;
  /** Verify command shown to the reader. */
  verifyCommand: string;
}

export const tv2: BrandAssetTv2 = {
  slug: "tv-2",
  label: "TV-2 multi-hour audit-trail run",
  submittedAt: "2026-05-06T17:37:26Z",
  closedAt: "2026-05-07T06:44:13Z",
  receiptCount: 4,
  calendarCount: 4,
  receipts: [
    {
      hourSlot: "2026-05-06T13",
      branches: [
        { calendar: "alice", blockHeight: 948198 },
        { calendar: "bob", blockHeight: 948198 },
        { calendar: "finney", blockHeight: 948198 },
        { calendar: "catallaxy", blockHeight: 948198 },
      ],
    },
    {
      hourSlot: "2026-05-06T14",
      branches: [
        { calendar: "alice", blockHeight: 948199 },
        { calendar: "bob", blockHeight: 948199 },
        { calendar: "finney", blockHeight: 948199 },
        { calendar: "catallaxy", blockHeight: 948199 },
      ],
    },
    {
      hourSlot: "2026-05-06T15",
      branches: [
        { calendar: "alice", blockHeight: 948223 },
        { calendar: "bob", blockHeight: 948223 },
        { calendar: "finney", blockHeight: 948223 },
        { calendar: "catallaxy", blockHeight: 948223 },
      ],
    },
    {
      hourSlot: "2026-05-06T16",
      branches: [
        { calendar: "alice", blockHeight: 948254 },
        { calendar: "bob", blockHeight: 948254 },
        { calendar: "finney", blockHeight: 948254 },
        { calendar: "catallaxy", blockHeight: 948254 },
      ],
    },
  ],
  blockHeightMin: 948198,
  blockHeightMax: 948254,
  blockHeightSpan: 56,
  verifyCommand: "wakir verify --archive .runtime/wat-tv2-archive",
};
