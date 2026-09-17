import type { Express } from "express";

const siteOrigin = () => (process.env.CANONICAL_ORIGIN ?? "").replace(/\/+$/, "");

export function registerSeoRoutes(app: Express) {
  app.get("/robots.txt", (_req, res) => {
    const origin = siteOrigin();
    const lines = [
      "# Классный Ремонт: правила обхода сайта",
      "User-agent: *",
      "Allow: /",
      "Disallow: /api/",
      "",
      "# AI-поисковые боты разрешены для цитирования публичных материалов.",
      "User-agent: GPTBot",
      "Allow: /",
      "User-agent: ChatGPT-User",
      "Allow: /",
      "User-agent: PerplexityBot",
      "Allow: /",
      "User-agent: ClaudeBot",
      "Allow: /",
      "User-agent: anthropic-ai",
      "Allow: /",
      "User-agent: Google-Extended",
      "Allow: /",
      "User-agent: bingbot",
      "Allow: /",
      "User-agent: YandexBot",
      "Allow: /",
    ];
    if (origin) lines.push("", `Sitemap: ${origin}/sitemap.xml`);
    res.type("text/plain").set("Cache-Control", "public, max-age=3600").send(`${lines.join("\n")}\n`);
  });

  app.get("/sitemap.xml", (_req, res) => {
    const origin = siteOrigin();
    if (!origin) {
      res.status(503).type("text/plain").send("Sitemap requires CANONICAL_ORIGIN configuration.");
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    res.type("application/xml").set("Cache-Control", "public, max-age=3600").send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${origin}/</loc><lastmod>${today}</lastmod></url>
</urlset>`);
  });
}
