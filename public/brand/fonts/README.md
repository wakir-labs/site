# Brand fonts — vendored

Stand: 2026-05-03 · Engineering: Tomás Reinhart

## Inhalt (erwartet)

```
fonts/
├── README.md                                  # this file
├── LICENSE-SIL-OFL-1.1.txt                    # font license (verbatim copy)
└── source-serif-4/
    ├── SourceSerif4-Bold.otf                  # weight 700, used for "Wakir"
    └── SourceSerif4-Semibold.otf              # weight 600, used for "Labs"
```

## Why we vendor the OTFs

The Phase-1 brand SVGs (`avatar-wakir-512-light.svg`,
`cover-wakir-labs-1500x500-light.svg`) call out
`font-family: 'Source Serif 4', 'Source Serif Pro', Georgia, serif`.
Rendering those SVGs to PNG requires the renderer's font-config to
resolve "Source Serif 4". On the claude-dev toolbox container the
font is not installed and `apt install`/`dnf install` is not
available without sudo escalation.

We vendor the Bold + Semibold OTFs into this repo so that:

- The conversion pipeline (`bash scripts/render-brand-png.sh`) is
  hermetic — no system-font-state dependency, no internet at build
  time.
- External contributors and CI on `wakir-labs/site` can render the
  PNGs identically without any setup.
- Brand output is byte-stable across machines (subject to the
  rasterizer used; see "Reproducibility" below).

## License (must read before redistributing)

Source Serif 4 by Adobe is published under the **SIL Open Font
License, Version 1.1**. The OFL explicitly permits redistribution
and bundling with software, including in commercial products,
**provided** that:

1. The font files are not sold by themselves (we don't — they are
   embedded as a build dependency).
2. The reserved font name is preserved (we use the unmodified
   upstream files; we do not rename or modify them).
3. The license text accompanies the fonts (`LICENSE-SIL-OFL-1.1.txt`
   in this directory).

**Source of the OTFs:** the upstream Adobe `source-serif` repo at
<https://github.com/adobe-fonts/source-serif>, release `4.005R`
(2023-01-20), asset `source-serif-4.005_Desktop.zip`. Fetched
2026-05-03 by Tomás Reinhart (Dev-Engineering) under formal
approval from Mira Kessler (CEO) — see
`agents-workspaces/dev-engineering/inbox/2026-05-03-svg-font-variante-a-approved.md`.

### Supply-chain pin (SHA-256)

Verify before re-vendoring or upgrading:

```
549fdb8f9a682bd06944298621404969f6de77c2e422ff3b8244a1dcd6a0c425  source-serif-4.005_Desktop.zip
f5fb9a7b1611353fdfebcf8b1e46c7d9108470f25999b841816d8b643b1856ff  source-serif-4/SourceSerif4-Bold.otf
25e034392847d9965c92f98971b3646436b7ab919ece9118b0c0e5ec94c02efc  source-serif-4/SourceSerif4-Semibold.otf
75784a295293a8992f5a8d99210566e0064a012e6dab6731305e3787f15896c7  LICENSE-SIL-OFL-1.1.txt
```

Files are unmodified upstream binaries; we did not strip metadata
or re-name the files. The reserved-font-name requirement of OFL
1.1 §3 is preserved.

## Provisioning (already executed — kept for reproducibility)

The OTFs are vendored as of commit 2026-05-03. To re-do the
provisioning from scratch (e.g. when bumping to a future release):

```bash
cd infra/repos-skeleton/site/public/brand/fonts

# Download official 4.005 Desktop release (note: asset name is
# 4.005_Desktop.zip, not 4.005R.zip — GitHub release tag is 4.005R).
curl -fsSL -o /tmp/source-serif-4.005_Desktop.zip \
  https://github.com/adobe-fonts/source-serif/releases/download/4.005R/source-serif-4.005_Desktop.zip

# Verify against the supply-chain pin above.
echo "549fdb8f9a682bd06944298621404969f6de77c2e422ff3b8244a1dcd6a0c425  /tmp/source-serif-4.005_Desktop.zip" \
  | sha256sum -c -

mkdir -p source-serif-4
unzip -j /tmp/source-serif-4.005_Desktop.zip \
  'source-serif-4.005_Desktop/OTF/SourceSerif4-Bold.otf' \
  'source-serif-4.005_Desktop/OTF/SourceSerif4-Semibold.otf' \
  -d source-serif-4/

# Copy the OFL license that ships in the same upstream zip.
unzip -j -o /tmp/source-serif-4.005_Desktop.zip \
  'source-serif-4.005_Desktop/LICENSE.md' -d .
mv LICENSE.md LICENSE-SIL-OFL-1.1.txt

git add -- source-serif-4/ LICENSE-SIL-OFL-1.1.txt
git commit -m "feat(brand): vendor Source Serif 4 (OFL 1.1)"
```

## Reproducibility

`rsvg-convert` honours `--font-config` if given a `fonts.conf` that
points at this directory. The convenience script
`scripts/render-brand-png.sh` (sibling to this directory) wraps
that. Inkscape resolves fonts via fontconfig too — the same
`fonts.conf` works for both.

**Caveat:** `rsvg-convert` and `inkscape` use different rasterizers
(libcairo vs. its own). Pixel output may differ at sub-pixel
boundaries. We pick one (rsvg-convert) and document the choice in
the parent `public/brand/README.md` so reviewers know which output
is canonical.
