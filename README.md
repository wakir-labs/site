# Wakir Labs — Site

Source for [wakirlabs.com](https://wakirlabs.com), the public site
and Phase-1 publication channel for **Wakir Labs**.

- Stack: Astro 4.x, pnpm, Cloudflare Pages
- License: Apache 2.0 (site code; prose remains copyright Wakir Labs
  unless explicitly placed under a different license at the file
  level)

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
production deploy; every PR gets a preview URL.

Build config (set in the Cloudflare Pages dashboard):

- Build command: `pnpm build`
- Output dir: `dist`
- Node version: 20

## Layout

Phase-1 Astro scaffold is intentionally minimal:

- `src/pages/index.astro` — landing page with brand wordmark and tagline.
- `src/layouts/Base.astro` — shared shell.
- `public/robots.txt` — crawl policy.
- i18n: English default, German under `/de/...`.

Content collections, RSS, Pagefind, and richer theming follow as the
site fills up. Initial posts are migrated from the editorial drafts
in the governance repo (`projects/comms/drafts/`) into
`src/content/blog/en/<slug>.md` once each piece is approved for
publication.

## License

Apache 2.0 for the site code. The `LICENSE` file lands with the
first repo sprint (Tomás).
