// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";

// https://astro.build/config
export default defineConfig({
  site: "https://wakirlabs.com",
  // @astrojs/sitemap temporarily disabled — Astro 4.16.19 + sitemap 3.7.2
  // crashes ("Cannot read properties of undefined reading 'reduce'") on builds
  // with i18n config and only stub pages. Re-enable once real routes exist
  // or after upgrading to Astro 6.x with matching sitemap version.
  integrations: [mdx()],
  i18n: {
    defaultLocale: "en",
    locales: ["en", "de"],
    routing: {
      prefixDefaultLocale: false,
    },
  },
  markdown: {
    shikiConfig: {
      theme: "github-dark-dimmed",
    },
  },
});
