#!/usr/bin/env bash
# pre-push-de-refs.sh — block pushes that drift EN-cross-refs on DE
# mirrors (Sprint-Frontend-4 Tag-2 lint-gate, analog to gitleaks).
#
# This is a HOOK FRAGMENT. It is invoked from `.git/hooks/pre-push`
# after the gitleaks scan. It scans the current worktree HEAD via
# `scripts/check-de-cross-refs.mjs` (Tag-1 lint substrate).
#
# Why worktree-HEAD, not commit-range:
#   The Tag-1 lint reads `src/layouts/Base.astro` and the
#   `src/pages/de/*.astro` directory state. A push that introduces
#   drift in any of those files will have HEAD reflect it. Range-
#   scoping the lint to a single commit would miss multi-commit
#   drift (a Base.astro change in commit N plus a /de/<page>.astro
#   reference in commit N+1). Worktree-HEAD covers both.
#
# Why hook-fragment, not standalone hook:
#   Git only honours one `pre-push` hook. The AI-Corp setup-git-hooks.sh
#   installs the gitleaks pre-push hook from
#   ai-corp/scripts/git-hooks/pre-push (Kai/Tomás-domain template).
#   To avoid touching the cross-domain template, this fragment is
#   APPENDED to the per-repo `.git/hooks/pre-push` by
#   scripts/install-de-refs-hook.sh — idempotent via sentinel markers.
#
# Bypass:
#   Set WAKIR_SKIP_DE_REFS=1 in the env. Use only for known false
#   positives that are not yet whitelist-pattern-matched; document
#   the reason in the commit message.

set -euo pipefail

if [[ "${WAKIR_SKIP_DE_REFS:-0}" == "1" ]]; then
    echo "[pre-push] WAKIR_SKIP_DE_REFS=1 — skipping de-cross-ref scan." >&2
    exit 0
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
LINT_SCRIPT="${REPO_ROOT}/scripts/check-de-cross-refs.mjs"

# If the lint substrate isn't present, this hook is a no-op. That
# matters for branches forked from before Sprint-Frontend-4 Tag-1
# that don't carry the script yet.
if [[ ! -f "${LINT_SCRIPT}" ]]; then
    exit 0
fi

# Node discovery — same convention as scripts/check-de-cross-refs.mjs
# (Node >= 20 with native ESM). The script itself shebangs to node,
# so we just need it on PATH.
if ! command -v node >/dev/null 2>&1; then
    echo "[pre-push] node not found — DE-cross-ref scan SKIPPED." >&2
    echo "[pre-push] Install Node >= 20 to enable this gate." >&2
    # Skip rather than block — the gate is additive, not a security
    # backstop like gitleaks. Operators without Node still get the
    # gitleaks block (security) and lose only the routing-quality lint.
    exit 0
fi

echo "[pre-push] de-cross-ref scan (scripts/check-de-cross-refs.mjs)"
if ! node "${LINT_SCRIPT}" --quiet; then
    cat >&2 <<EOF

[pre-push] BLOCKED — EN-cross-ref drift on a DE mirror.

A DE mirror page (\`src/pages/de/<slug>.astro\`) links to an EN-only
path (e.g. \`/verifier/\`) when a DE counterpart (\`/de/verifier/\`)
exists. That bounces DE readers into the EN site mid-article.

Run the lint with verbose output to see per-line findings:

    node scripts/check-de-cross-refs.mjs

Fix: replace the EN path with the DE counterpart, unless the link
is a \`Read in English\` / \`englische Lesehilfe\` language-switch
(both are whitelisted).

Last resort (NEVER for genuine drift):
    WAKIR_SKIP_DE_REFS=1 git push ...
    Document why in the commit message.

EOF
    exit 1
fi

echo "[pre-push] de-cross-ref: clean."
exit 0
