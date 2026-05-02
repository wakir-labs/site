// render-brand-pngs.mjs — convert public/brand/*.svg to PNG using
// @resvg/resvg-js. Use this when the host has neither rsvg-convert
// nor inkscape (see public/brand/README.md, Variante C).
//
// Run from the site repo root:
//   npm install @resvg/resvg-js
//   node scripts/render-brand-pngs.mjs
//
// The script aborts with a clear message if it falls back to a
// non-brand font, so we never accidentally commit a Liberation-Serif
// rendering and pretend it was Source Serif 4.

import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const BRAND_DIR = resolve(REPO_ROOT, 'public/brand');

// Probe a few likely Source Serif locations. Order:
//   1. Vendored fonts in this repo (public/brand/fonts/source-serif-4/) —
//      preferred. Once Aufsichtsrat approves the OFL vendor commit, this
//      path resolves first and the build is hermetic.
//   2. Adobe Source Serif 4 system install (current upstream name).
//   3. Source Serif Pro (older Fedora pkg name).
const VENDORED_DIR = resolve(BRAND_DIR, 'fonts/source-serif-4');
const SOURCE_SERIF_CANDIDATES = [
    resolve(VENDORED_DIR, 'SourceSerif4-Bold.otf'),
    resolve(VENDORED_DIR, 'SourceSerif4-Semibold.otf'),
    resolve(VENDORED_DIR, 'SourceSerif4-Regular.otf'),
    '/usr/share/fonts/source-serif/SourceSerif4-Regular.otf',
    '/usr/share/fonts/source-serif/SourceSerif4-Bold.otf',
    '/usr/share/fonts/source-serif-pro/SourceSerifPro-Regular.otf',
    '/usr/share/fonts/source-serif-pro/SourceSerifPro-Bold.otf',
    '/usr/share/fonts/adobe-source-serif-pro/SourceSerifPro-Regular.otf',
    '/usr/share/fonts/adobe-source-serif-pro/SourceSerifPro-Bold.otf',
];
const SOURCE_SERIF_FILES = SOURCE_SERIF_CANDIDATES.filter(p => existsSync(p));

const FALLBACK_LIBERATION = [
    '/usr/share/fonts/liberation-serif-fonts/LiberationSerif-Regular.ttf',
    '/usr/share/fonts/liberation-serif-fonts/LiberationSerif-Bold.ttf',
    '/usr/share/fonts/liberation-serif-fonts/LiberationSerif-Italic.ttf',
    '/usr/share/fonts/liberation-serif-fonts/LiberationSerif-BoldItalic.ttf',
];

const usingSourceSerif = SOURCE_SERIF_FILES.length > 0;
const fontFiles = usingSourceSerif ? SOURCE_SERIF_FILES : FALLBACK_LIBERATION.filter(p => existsSync(p));
const defaultFamily = usingSourceSerif ? 'Source Serif 4' : 'Liberation Serif';
const serifFamily   = defaultFamily;

if (!usingSourceSerif) {
    console.warn('');
    console.warn('[brand-render] WARNING: Source Serif 4 / Source Serif Pro is not installed.');
    console.warn('[brand-render] Falling back to Liberation Serif. The rendered PNGs are NOT brand-conformant.');
    console.warn('[brand-render] Do not commit these PNGs. Provision Source Serif 4 first:');
    console.warn('[brand-render]   Vendored: see public/brand/fonts/README.md (preferred — hermetic build)');
    console.warn('[brand-render]   Fedora:   sudo dnf install adobe-source-serif-pro-fonts');
    console.warn('[brand-render]   Manual:   drop OTFs into /usr/share/fonts/source-serif/');
    console.warn('');
}

const targets = [
    {
        svg:    resolve(BRAND_DIR, 'avatar-wakir-512-light.svg'),
        png:    resolve(BRAND_DIR, 'avatar-wakir-512-light.png'),
        width:  512,
        height: 512,
    },
    {
        svg:    resolve(BRAND_DIR, 'cover-wakir-labs-1500x500-light.svg'),
        png:    resolve(BRAND_DIR, 'cover-wakir-labs-1500x500-light.png'),
        width:  1500,
        height: 500,
    },
];

let exitCode = 0;
for (const t of targets) {
    try {
        const svg = readFileSync(t.svg);
        const resvg = new Resvg(svg, {
            fitTo:      { mode: 'width', value: t.width },
            background: '#FAF7F0',
            font: {
                loadSystemFonts:   true,
                fontFiles,
                defaultFontFamily: defaultFamily,
                serifFamily,
            },
        });
        const out = resvg.render().asPng();
        writeFileSync(t.png, out);
        console.log(`[brand-render] ${t.png}  (${out.length} bytes, ${t.width}x${t.height}, font=${defaultFamily})`);
    } catch (e) {
        console.error(`[brand-render] FAILED for ${t.svg}: ${e.message}`);
        exitCode = 1;
    }
}

if (!usingSourceSerif) {
    // Make the wrong-font outcome impossible to ignore from CI.
    console.error('[brand-render] EXIT 2 — wrong font; PNGs written but flagged as not-for-commit.');
    exitCode = 2;
}

process.exit(exitCode);
