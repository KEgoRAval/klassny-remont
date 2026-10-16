import type { Express } from "express";
import { blogPosts } from "../../client/src/content/blog";
import { servicePages } from "../../client/src/content/services";

const siteOrigin = () => (process.env.CANONICAL_ORIGIN ?? "").replace(/\/+$/, "");

/**
 * Date the home page content last changed. Update it with a release that changes the home page:
 * a lastmod that moves on every request teaches search engines to ignore lastmod for the whole site.
 */
export const HOME_UPDATED_AT = "2026-10-12";

/** The blog index changes when a post is added or updated. */
export const blogUpdatedAt = () => blogPosts.map(post => post.modifiedAt).sort().at(-1) ?? HOME_UPDATED_AT;

/** Crawlers named here read only their own group, so each group repeats the closed paths. */
const CRAWLERS = ["*", "YandexBot", "GPTBot", "ChatGPT-User", "PerplexityBot", "ClaudeBot", "anthropic-ai", "Google-Extended", "bingbot"];

export function registerSeoRoutes(app: Express) {
  app.get("/robots.txt", (_req, res) => {
    const origin = siteOrigin();
    const lines = ["# Классный Ремонт: правила обхода сайта", "# AI-поисковые боты разрешены для цитирования публичных материалов."];
    for (const agent of CRAWLERS) lines.push("", `User-agent: ${agent}`, "Allow: /", "Disallow: /api/");
    if (origin) lines.push("", `Sitemap: ${origin}/sitemap.xml`);
    res.type("text/plain").set("Cache-Control", "public, max-age=3600").send(`${lines.join("\n")}\n`);
  });

  app.get("/sitemap.xml", (_req, res) => {
    const origin = siteOrigin();
    if (!origin) {
      res.status(503).type("text/plain").send("Sitemap requires CANONICAL_ORIGIN configuration.");
      return;
    }
    const urls = [
      { path: "/", lastmod: HOME_UPDATED_AT, priority: "1.0" },
      ...servicePages.map(page => ({ path: page.path, lastmod: page.modifiedAt, priority: "0.9" })),
      { path: "/blog", lastmod: blogUpdatedAt(), priority: "0.9" },
      ...blogPosts.map(post => ({ path: post.path, lastmod: post.modifiedAt, priority: "0.8" })),
    ];
    const nodes = urls.map(item => `  <url><loc>${origin}${item.path}</loc><lastmod>${item.lastmod}</lastmod><changefreq>monthly</changefreq><priority>${item.priority}</priority></url>`).join("\n");
    res.type("application/xml").set("Cache-Control", "public, max-age=3600").send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${nodes}
</urlset>`);
  });
}
