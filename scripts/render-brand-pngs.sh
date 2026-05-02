#!/usr/bin/env bash
# render-brand-pngs.sh — convenience wrapper for scripts/render-brand-pngs.mjs.
# Installs the resvg-js dep on demand and runs the renderer.
#
# Use case: build host has neither rsvg-convert nor inkscape but does
# have node + npm. See public/brand/README.md Variante C.
#
# Brand-conformance guard: the underlying .mjs exits with code 2 when
# Source Serif 4 / Source Serif Pro is missing. This wrapper propagates
# that exit code. Treat exit 2 as "rendered PNGs are not brand-clean,
# do not commit them".

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."   # site repo root

if [[ ! -d node_modules/@resvg/resvg-js ]]; then
    echo "[brand-render] installing @resvg/resvg-js..."
    npm install --no-audit --no-fund @resvg/resvg-js
fi

exec node scripts/render-brand-pngs.mjs
