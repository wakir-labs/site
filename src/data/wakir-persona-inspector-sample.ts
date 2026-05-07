/**
 * Wakir Persona-Inspector — sample directory payload for the
 * internal-only `/persona-inspector/` page.
 *
 * The persona-inspector is an INTERNAL-ONLY surface. The page that
 * consumes this payload sets `noindex,nofollow` and is not part of
 * the marketing surface. The data shape is deliberately minimal:
 *
 *   - role-string slug (the inter-agent identifier; safe in any
 *     surface because it is not a clear-name)
 *   - role label (functional role description; not a clear-name)
 *   - activation status (active / in-activation per ADR-0040 wave-3)
 *   - persona-hash-pin constant name (the named export of the
 *     persona-engine that pins the canonical-subset shape of the
 *     persona-definition file; the raw hash is shared across the
 *     pin pack and lives on `/audit-trail/`)
 *   - constituting ADR (the architecture decision that activated
 *     this role; reviewers can cross-reference governance)
 *
 * Brand-Guide §9 (blocklist path):
 *   - role-strings only: `mira`, `tomas`, `reza`, `kai`, `selin`,
 *     `lena`, `aisha`, `julia`, `daniel`, `henrik`, `priya`. These
 *     are bare first-name slugs (single-word), explicitly allowed by
 *     §9.1 — the `pre-commit-klarnamen-check.sh` hook only flags the
 *     full first-and-last form, never the bare slug.
 *   - no clear-names (no surnames, no full names) anywhere in this
 *     file or in user-visible text.
 *   - no persona-count statement: the surface lists individual cards
 *     without ever rendering a total count, a "we are N roles"
 *     headline, or a `length`-derived label. The ADR-0040..0045 wave
 *     references are the only persona-count signal, and they appear
 *     as opaque ADR ids, not as integers tied to the directory.
 *
 * Substance:
 *   The slugs, roles, activation state, and ADR ids below are real.
 *   They mirror `scripts/lib/wakir-personas.txt` (single source of
 *   truth for clear-name leak detection) and the ADRs 0001..0045 in
 *   `decisions/`. The persona-hash-pin constant `PERSONA_HASH_PIN_V9`
 *   is the live constant exported by the persona-engine on Wakir-day
 *   2026-05-07 (see `/audit-trail/` entry `persona-hash-pin-v9`).
 */

/**
 * Activation lifecycle of a persona. `active` means the role is
 * delivering work today; `in-activation` means the role's persona
 * file is approved (ADR landed) but the agent has not yet been
 * spawned for productive output. Mirrors the wave-3 distinction
 * documented in `scripts/lib/wakir-personas.txt`.
 */
export type PersonaActivationStatus = "active" | "in-activation";

/**
 * One row of the persona directory. The shape is intentionally flat:
 * the inspector is a read-only structural sketch, not a configuration
 * editor (the persona-configuration UI is a Phase-2 surface).
 */
export interface PersonaInspectorEntry {
  /**
   * Inter-agent role slug. Single-word, lowercase, ASCII. This is
   * the same slug used in `subagent_type=…`, in NATS subject mapping,
   * and in cross-review references. It is NOT a clear-name.
   */
  slug: string;
  /**
   * Functional role label, in the form used in the role-string
   * directory (`dev-engineering`, `wirelang-eng`, `frontend-eng`).
   * Plain functional descriptor, not a clear-name.
   */
  role: string;
  /**
   * One-sentence description of the domain the role owns. Read off
   * the persona files; kept short so a reviewer can scan the
   * directory at glance.
   */
  domain: string;
  /** Activation lifecycle — see `PersonaActivationStatus`. */
  status: PersonaActivationStatus;
  /**
   * Persona-hash-pin constant name. The raw SHA-256 lives on the
   * audit-trail page (`/audit-trail/`, entry `persona-hash-pin-v9`).
   * Constant name only here keeps the inspector readable and avoids
   * duplicating a hash that might drift across surfaces.
   */
  hashPinConstant: string;
  /**
   * Constituting ADR — the architecture decision that activated this
   * role. For the wave-3 cohort, this is the activation ADR (0040
   * frontend, 0041 cto, etc.). For pre-wave-3 roles, this is the
   * earlier activation ADR (0001 charter, 0029 hr, etc.).
   */
  adr: string;
  /**
   * Optional notes — used to record cross-review zone ownership when
   * relevant for the reviewer scanning the directory. Kept short.
   */
  note?: string;
}

/**
 * Sample persona directory. Eleven role-string slugs, no clear-names,
 * no count statement. Order is the natural ADR-arrival order for the
 * activation wave so a reviewer reads the directory the way the org
 * grew. The directory is NOT exhaustive — it is the substance the
 * inspector renders today; additions land paired with their ADR.
 *
 * No `length` of this array is rendered in the UI. The page does not
 * say "11 personas"; it lists individual cards.
 */
export const samplePersonaInspector: PersonaInspectorEntry[] = [
  {
    slug: "mira",
    role: "ceo",
    domain:
      "Org leadership; strategic decisions inside the delegation matrix; supervisory-board liaison.",
    status: "active",
    hashPinConstant: "PERSONA_HASH_PIN_V9",
    adr: "ADR-0001 (charter); ADR-0017 (mandate refinement)",
  },
  {
    slug: "tomas",
    role: "dev-engineering",
    domain:
      "WAT-core, OTS-substrate, manifest-v2 verifier, archive-pipeline; engineering-lead matrix-coordinator.",
    status: "active",
    hashPinConstant: "PERSONA_HASH_PIN_V9",
    adr: "ADR-0017; ADR-0033 (engineering-lead matrix)",
  },
  {
    slug: "julia",
    role: "comms",
    domain:
      "Brand-voice, micro-text review, position-paper editing; cross-review zone-G owner for marketing-site content.",
    status: "active",
    hashPinConstant: "PERSONA_HASH_PIN_V9",
    adr: "ADR-0024 (comms persona)",
  },
  {
    slug: "daniel",
    role: "cfo",
    domain:
      "Treasury accounting, runway forecasts, regulated-payment-rail decisions; supervisory-board financial reporting.",
    status: "active",
    hashPinConstant: "PERSONA_HASH_PIN_V9",
    adr: "ADR-0026 (cfo persona)",
  },
  {
    slug: "henrik",
    role: "internal-audit",
    domain:
      "Audit-sample drawing across all roles; ADR-0025 three-axis performance review; honesty-pattern enforcement.",
    status: "active",
    hashPinConstant: "PERSONA_HASH_PIN_V9",
    adr: "ADR-0028 (internal-audit persona)",
  },
  {
    slug: "aisha",
    role: "hr",
    domain:
      "Persona activation, cross-review session moderation, consensus-timestamp recording; org-design.",
    status: "active",
    hashPinConstant: "PERSONA_HASH_PIN_V9",
    adr: "ADR-0029 (hr persona)",
  },
  {
    slug: "reza",
    role: "wirelang-eng",
    domain:
      "Inter-agent protocol layer 0-2, wirelang spec, schema registry, capability-token format.",
    status: "active",
    hashPinConstant: "PERSONA_HASH_PIN_V9",
    adr: "ADR-0031 (wirelang-eng persona)",
  },
  {
    slug: "kai",
    role: "devops-eng",
    domain:
      "Container orchestration, secrets management, hosting substrate; cross-review zone-F partner.",
    status: "active",
    hashPinConstant: "PERSONA_HASH_PIN_V9",
    adr: "ADR-0032 (devops-eng persona)",
  },
  {
    slug: "lena",
    role: "frontend-eng",
    domain:
      "Astro static-site, marketing-surface, internal-only inspector pages, whitepaper-render-pipeline (deferred).",
    status: "in-activation",
    hashPinConstant: "PERSONA_HASH_PIN_V9",
    adr: "ADR-0040 (frontend-eng persona)",
    note: "Cross-review zones E (wirelang-schema), F (devops-eng), G (comms).",
  },
  {
    slug: "priya",
    role: "cto",
    domain:
      "Engineering-lead matrix flatten; ADR-0045 direct-report line for engineering personae; technical strategy.",
    status: "in-activation",
    hashPinConstant: "PERSONA_HASH_PIN_V9",
    adr: "ADR-0041 (cto persona); ADR-0045 (matrix-flatten)",
  },
  {
    slug: "selin",
    role: "persona-engine-eng",
    domain:
      "Persona-engine, persona-converter (V0..V9), canonical-subset hashing, persona-hash-pin lifecycle.",
    status: "in-activation",
    hashPinConstant: "PERSONA_HASH_PIN_V9",
    adr: "ADR-0044 (persona-engine-eng persona)",
  },
];
