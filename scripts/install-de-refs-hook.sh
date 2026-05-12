#!/usr/bin/env bash
# install-de-refs-hook.sh — append the de-refs hook-fragment to the
# repo-local `.git/hooks/pre-push`, idempotent via sentinel markers.
#
# Why this script exists:
#   - The AI-Corp gitleaks pre-push template lives in
#     ai-corp/scripts/git-hooks/pre-push (Kai/Tomás-domain shared).
#   - Adding de-refs to that template would cross-cut domains.
#   - Git allows only one pre-push hook per repo.
#   - Therefore this installer APPENDS a small dispatch block to the
#     per-repo `.git/hooks/pre-push`, marked with sentinel comments
#     so re-runs are no-ops.
#
# Caveat:
#   `ai-corp/scripts/setup-git-hooks.sh` will overwrite
#   `.git/hooks/pre-push` next time it runs. After that, this
#   installer needs to be re-run. The recommended cadence is to
#   call it from the site repo's `package.json` postinstall, or
#   manually after any AI-Corp-side hook setup.
#
# Usage:
#   bash scripts/install-de-refs-hook.sh           # install (idempotent)
#   bash scripts/install-de-refs-hook.sh --check   # report installation state, exit 0/1
#   bash scripts/install-de-refs-hook.sh --uninstall  # remove the block

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HOOK_PATH="${REPO_ROOT}/.git/hooks/pre-push"
FRAGMENT_PATH="${REPO_ROOT}/scripts/git-hooks/pre-push-de-refs.sh"

BEGIN_MARKER="# BEGIN: de-refs-check (sprint-frontend-4-tag-2)"
END_MARKER="# END: de-refs-check (sprint-frontend-4-tag-2)"

MODE="${1:-install}"

is_installed() {
    [[ -f "${HOOK_PATH}" ]] && grep -qF "${BEGIN_MARKER}" "${HOOK_PATH}"
}

case "${MODE}" in
    --check)
        if is_installed; then
            echo "de-refs-hook: INSTALLED in ${HOOK_PATH}"
            exit 0
        else
            echo "de-refs-hook: NOT installed in ${HOOK_PATH}"
            exit 1
        fi
        ;;

    --uninstall)
        if [[ ! -f "${HOOK_PATH}" ]]; then
            echo "de-refs-hook: no pre-push hook at ${HOOK_PATH} — nothing to do."
            exit 0
        fi
        if ! is_installed; then
            echo "de-refs-hook: not installed — nothing to do."
            exit 0
        fi
        # Strip the block (inclusive of both markers). Use awk
        # index() for literal substring matching — the marker strings
        # contain parentheses that would be regex-grouping under `~`
        # and not matched literally.
        tmp="$(mktemp)"
        awk -v b="${BEGIN_MARKER}" -v e="${END_MARKER}" '
            index($0, b) > 0 { skipping = 1; next }
            index($0, e) > 0 { skipping = 0; next }
            !skipping
        ' "${HOOK_PATH}" > "${tmp}"
        mv "${tmp}" "${HOOK_PATH}"
        chmod +x "${HOOK_PATH}"
        echo "de-refs-hook: removed from ${HOOK_PATH}"
        exit 0
        ;;

    install|"")
        if [[ ! -f "${FRAGMENT_PATH}" ]]; then
            echo "[install-de-refs-hook] FAIL: fragment not found at ${FRAGMENT_PATH}" >&2
            echo "[install-de-refs-hook] Run from the site repo root after Sprint-Frontend-4 Tag-2." >&2
            exit 2
        fi

        # If no pre-push hook exists yet, seed one with a minimal
        # shebang. The gitleaks hook (if installed later by
        # setup-git-hooks.sh) will overwrite it; this installer
        # would then need to be re-run.
        if [[ ! -f "${HOOK_PATH}" ]]; then
            mkdir -p "$(dirname "${HOOK_PATH}")"
            cat > "${HOOK_PATH}" <<'EOF'
#!/usr/bin/env bash
# pre-push — site-local hook, seeded by scripts/install-de-refs-hook.sh
set -euo pipefail
EOF
            chmod +x "${HOOK_PATH}"
        fi

        if is_installed; then
            echo "de-refs-hook: already installed in ${HOOK_PATH} — no-op."
            exit 0
        fi

        # Build the dispatch block. It must run BEFORE the existing
        # hook's final `exit 0` (otherwise it is unreachable). Strategy:
        # strip any trailing `exit 0` from the existing hook, append
        # the dispatch block, then re-append `exit 0` at the end. This
        # is idempotent because the BEGIN/END sentinels gate the
        # whole transformation.
        #
        # The block must not consume stdin (the gitleaks hook above
        # already drains the push-tuple stream in its `while read`
        # loop); the fragment is worktree-HEAD-based and doesn't need
        # stdin.
        tmp="$(mktemp)"
        # awk: drop a final standalone `exit 0` line (and any blank
        # lines immediately before it) so we can re-append below.
        awk '
            { lines[NR] = $0 }
            END {
                # Find last non-blank line; if it is "exit 0", drop it.
                last = NR
                while (last > 0 && lines[last] ~ /^[[:space:]]*$/) last--
                drop = 0
                if (last > 0 && lines[last] ~ /^[[:space:]]*exit[[:space:]]+0[[:space:]]*$/) {
                    drop = last
                }
                for (i = 1; i <= NR; i++) {
                    if (drop > 0 && i >= drop) break
                    print lines[i]
                }
            }
        ' "${HOOK_PATH}" > "${tmp}"

        cat >> "${tmp}" <<EOF

${BEGIN_MARKER}
# Routing-quality gate: blocks pushes that drift EN-cross-refs on
# DE mirrors. Source: scripts/git-hooks/pre-push-de-refs.sh
# (Sprint-Frontend-4 Tag-2). Idempotent installer:
# scripts/install-de-refs-hook.sh. The installer strips the
# preceding hook's trailing \`exit 0\` so this block is reachable.
if [[ -x "\$(git rev-parse --show-toplevel)/scripts/git-hooks/pre-push-de-refs.sh" ]]; then
    bash "\$(git rev-parse --show-toplevel)/scripts/git-hooks/pre-push-de-refs.sh" </dev/null
fi
${END_MARKER}

exit 0
EOF

        mv "${tmp}" "${HOOK_PATH}"
        chmod +x "${HOOK_PATH}"
        echo "de-refs-hook: installed in ${HOOK_PATH}"
        exit 0
        ;;

    *)
        echo "Usage: $0 [install|--check|--uninstall]" >&2
        exit 2
        ;;
esac
