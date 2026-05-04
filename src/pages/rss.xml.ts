import rss from "@astrojs/rss";
import type { APIContext } from "astro";

/**
 * RSS feed for Wakir Labs long-form essays.
 *
 * Today the site has exactly one essay page (`/why-we-are-wakir-labs/`),
 * authored as a hand-rolled `.astro` page. Until a content collection
 * lands (Phase-2 backlog), the feed is driven by the `essays` array
 * below.
 *
 * When essays migrate to a content collection, replace the inline
 * array with:
 *
 *     import { getCollection } from "astro:content";
 *     const posts = await getCollection("essays", e => !e.data.draft);
 *     const items = posts
 *       .sort((a, b) => +new Date(b.data.date) - +new Date(a.data.date))
 *       .map(p => ({
 *         title: p.data.title,
 *         description: p.data.description,
 *         link: `/${p.slug}/`,
 *         pubDate: new Date(p.data.date),
 *       }));
 *
 * Until then: every new essay page must add an entry here, sorted by
 * `date` (newest first). The build will not enforce this — keep the
 * comment honest.
 */

interface EssayEntry {
  title: string;
  description: string;
  /** Site-relative path, must end with a trailing slash to match Astro routing. */
  link: string;
  /** ISO date string (YYYY-MM-DD). Used for sorting and pubDate. */
  date: string;
}

const essays: EssayEntry[] = [
  {
    title: "Why we are Wakir Labs",
    description:
      "An Arabic word for an appointed agent gave us a name; an old discipline of writing things down gives us a method.",
    link: "/why-we-are-wakir-labs/",
    date: "2026-05-04",
  },
];

export async function GET(context: APIContext) {
  const sorted = [...essays].sort(
    (a, b) => +new Date(b.date) - +new Date(a.date),
  );

  return rss({
    title: "Wakir Labs — Essays",
    description:
      "Long-form essays from Wakir Labs on accountable multi-agent systems, governance, and the framework we are building.",
    site: context.site ?? "https://wakirlabs.com",
    items: sorted.map((e) => ({
      title: e.title,
      description: e.description,
      link: e.link,
      pubDate: new Date(e.date),
    })),
    customData: "<language>en-us</language>",
  });
}
