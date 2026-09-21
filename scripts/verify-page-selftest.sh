#!/usr/bin/env bash
# Walk /verify/ the way a stranger would, and fail if the page promises
# something the repository cannot deliver.
#
# Why this exists: three separate defects shipped on that page, and every
# one of them was invisible from the inside because nobody ran the
# instructions end to end.
#
#   2026-09-15  the published command fed the wrong digest — both forms
#   2026-09-15  "every commit ... is timestamped" was false for 3 of 4 repos
#   2026-09-20  the page claimed a block-explorer fallback that does not exist,
#               and told the reader to pick any proof file — 32 of 60 name
#               commits a plain clone cannot resolve
#
# The guard deliberately stops where a Bitcoin node would be needed. The
# class of defect it catches is "the digest convention drifted from the
# hook", and that shows up before any chain access.
set -euo pipefail

PAGE="${1:-src/pages/verify.astro}"
fail() { echo "verify-page-selftest: $*" >&2; exit 1; }

command -v ots >/dev/null 2>&1 || fail "ots not on PATH"

# 1. The worked example named on the page must resolve in this clone.
EXAMPLE="$(grep -oE 'meta/timestamps/[0-9a-f]{7,40}\.ots' "${PAGE}" | head -1 | sed 's|.*/||; s|\.ots$||')"
[[ -n "${EXAMPLE}" ]] || fail "no worked example found in ${PAGE}"
git cat-file -e "${EXAMPLE}^{commit}" 2>/dev/null \
    || fail "worked example ${EXAMPLE} does not resolve in a plain clone"
[[ -f "meta/timestamps/${EXAMPLE}.ots" ]] \
    || fail "proof file for ${EXAMPLE} is missing"

# 2. The digest convention on the page must match what the hook stamps.
printf "%s\n" "$(git rev-parse "${EXAMPLE}")" > /tmp/selftest-commit.txt
# The discriminator is the digest stage, not the chain stage: with the wrong
# convention ots says "does not match"; with the right one it gets past that
# and stops at the Bitcoin node (which CI does not have). Both are fine here —
# "does not match" is not.
OUT="$(ots verify -f /tmp/selftest-commit.txt "meta/timestamps/${EXAMPLE}.ots" 2>&1 || true)"
if grep -q "does not match" <<<"${OUT}"; then
    fail "digest mismatch — the page's convention drifted from the hook:
${OUT}"
fi
grep -qE "Could not connect to Bitcoin node|Success!|attests existence" <<<"${OUT}" \
    || fail "ots stopped somewhere unexpected — neither a node error nor a success:
${OUT}"

# 3. Negative control: a different commit must be rejected. Without this the
#    check above would also pass against a verifier that accepts anything.
OTHER="$(git rev-parse HEAD)"
printf "%s\n" "${OTHER}" > /tmp/selftest-wrong.txt
NEG="$(ots verify -f /tmp/selftest-wrong.txt "meta/timestamps/${EXAMPLE}.ots" 2>&1 || true)"
grep -q "does not match" <<<"${NEG}" \
    || fail "negative control did not fail — a wrong commit was not rejected:
${NEG}"

# 4. Claims about counts must match the tree.
TOTAL="$(ls meta/timestamps/*.ots 2>/dev/null | wc -l)"
RESOLVABLE=0
for f in meta/timestamps/*.ots; do
    h="$(basename "${f}" .ots)"
    git cat-file -e "${h}^{commit}" 2>/dev/null && RESOLVABLE=$((RESOLVABLE+1)) || true
done
if grep -qE 'of [0-9]+ proof files, [0-9]+ resolve' "${PAGE}"; then
    CLAIMED_TOTAL="$(grep -oE 'of [0-9]+ proof files' "${PAGE}" | head -1 | grep -oE '[0-9]+')"
    CLAIMED_RES="$(grep -oE 'proof files, [0-9]+ resolve' "${PAGE}" | head -1 | grep -oE '[0-9]+')"
    [[ "${CLAIMED_TOTAL}" == "${TOTAL}" ]] \
        || fail "page claims ${CLAIMED_TOTAL} proof files, tree has ${TOTAL}"
    [[ "${CLAIMED_RES}" == "${RESOLVABLE}" ]] \
        || fail "page claims ${CLAIMED_RES} resolvable, tree has ${RESOLVABLE}"
fi

echo "verify-page-selftest: ok — example ${EXAMPLE}, ${RESOLVABLE}/${TOTAL} proofs resolvable"
