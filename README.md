# Wakir Labs — Site

Public website and Phase-1 publication channel for **Wakir Labs**.

- Stack: Astro 4.x + pnpm + Cloudflare Pages
- Domain: https://wakirlabs.com
- License: Apache 2.0

## Local development

```bash
pnpm install
pnpm dev
```

The dev server runs on http://localhost:4321.

## Build

```bash
pnpm build       # outputs to dist/
pnpm preview     # serve dist/ locally
```

## Deploy

Cloudflare Pages is wired to this repo. Push to `main` triggers a
production deploy. Every PR gets a preview URL.

Build config (set in the Cloudflare Pages dashboard):

- Build command: `pnpm build`
- Output dir: `dist`
- Node version: 20

## Layout

This repository follows the spec in
`projects/comms/plattform-spec-fuer-tomas.md` (governance repo, internal).
Phase-1 Astro scaffold is intentionally minimal:

- `src/pages/index.astro` — landing page with brand wordmark + tagline.
- `src/layouts/Base.astro` — shared shell.
- `public/robots.txt` — crawl policy.
- i18n: English default, German under `/de/...`.

Content collections, RSS, Pagefind, and richer theming follow once the
site is live.

## License

Apache 2.0. Site copy and prose remain copyright Wakir Labs unless
explicitly placed under a different license at the file level.
