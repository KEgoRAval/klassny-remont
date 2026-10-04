import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import superjson from "superjson";
import viteConfig from "../../vite.config";
import type { HeadMeta } from "../../client/src/ssr/prefetch";
import { staticCacheControl } from "./staticAssets";

const escapeHtml = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/\"/g, "&quot;")
  .replace(/'/g, "&#39;");

const compactText = (value: string, max: number) => {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.lastIndexOf(" ", max);
  return (cut > max * 0.6 ? text.slice(0, cut) : text.slice(0, max)) + "…";
};

const canonicalOrigin = () => (process.env.CANONICAL_ORIGIN ?? "").replace(/\/+$/, "");
const siteName = () => process.env.SITE_NAME ?? "Классный Ремонт";

const absolutizeStructuredData = (data: unknown, origin: string): unknown => {
  if (typeof data === "string") return origin && data.startsWith("/") ? `${origin}${data}` : data;
  if (Array.isArray(data)) return data.map(value => absolutizeStructuredData(value, origin));
  if (data && typeof data === "object") {
    return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, absolutizeStructuredData(value, origin)]));
  }
  return data;
};

function buildHeadTags(head: HeadMeta) {
  const title = escapeHtml(compactText(head.title, 90) || siteName());
  const description = escapeHtml(compactText(head.description.replace(/[#*_`~]+/g, ""), 200));
  const origin = canonicalOrigin();
  const canonicalUrl = origin && head.canonicalPath ? `${origin}${head.canonicalPath}` : "";
  const image = head.ogImage?.startsWith("/") && origin ? `${origin}${head.ogImage}` : head.ogImage;
  const tags = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<meta name="robots" content="${head.noindex || head.notFound ? "noindex, follow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"}" />`,
    `<meta name="theme-color" content="#18241d" />`,
    `<meta property="og:type" content="${head.ogType ?? "website"}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:locale" content="ru_RU" />`,
    `<meta property="og:site_name" content="${escapeHtml(siteName())}" />`,
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
  ];
  if (canonicalUrl) {
    tags.push(`<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`);
    tags.push(`<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`);
  }
  if (image) {
    tags.push(`<meta property="og:image" content="${escapeHtml(image)}" />`);
    tags.push(`<meta property="og:image:alt" content="${escapeHtml(head.ogImageAlt ?? "Классный Ремонт — ремонт квартир в Москве")}" />`);
    tags.push(`<meta name="twitter:image" content="${escapeHtml(image)}" />`);
  }
  if (head.ogType === "article" && head.publishedAt) {
    tags.push(`<meta property="article:published_time" content="${escapeHtml(head.publishedAt)}" />`);
  }
  if (head.ogType === "article" && head.modifiedAt) {
    tags.push(`<meta property="article:modified_time" content="${escapeHtml(head.modifiedAt)}" />`);
  }
  if (head.structuredData) {
    tags.push(`<script type="application/ld+json">${JSON.stringify(absolutizeStructuredData(head.structuredData, origin)).replace(/</g, "\\u003c")}</script>`);
  }
  return tags.join("\n");
}

function composeHtml(template: string, appHtml: string, head: HeadMeta, dehydratedState: unknown) {
  const state = JSON.stringify(superjson.serialize(dehydratedState)).replace(/</g, "\\u003c");
  return template
    .replace("</body>", () => `<script>window.__RQ_STATE__ = ${state}</script></body>`)
    .replace("<!--app-head-->", () => buildHeadTags(head))
    .replace("<!--app-html-->", () => appHtml);
}

export async function setupVite(app: Express, server: Server) {
  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: { middlewareMode: true, hmr: { server }, allowedHosts: true },
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    try {
      const clientTemplate = path.resolve(import.meta.dirname, "../..", "client", "index.html");
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace("src=\"/src/entry-client.tsx\"", `src="/src/entry-client.tsx?v=${nanoid()}"`);
      template = await vite.transformIndexHtml(req.originalUrl, template);
      template = template.replace("</head>", "<link rel=\"stylesheet\" href=\"/src/index.css?direct\" data-ssr-dev-css></head>");
      const { render } = await vite.ssrLoadModule("/src/entry-server.tsx");
      const { html, dehydratedState, head } = await render(req.originalUrl);
      res.status(head.notFound ? 404 : 200).set("Cache-Control", "no-cache").type("html").end(composeHtml(template, html, head, dehydratedState));
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      console.error("[SSR] dev render failed:", error);
      next(error);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");
  const serverEntryPath = path.resolve(import.meta.dirname, "server-ssr", "entry-server.js");

  if (!fs.existsSync(distPath)) {
    console.error("Could not find the build directory. Run pnpm build before starting production.");
  }

  app.use((req, res, next) => {
    if (req.path === "/index.html") return res.redirect(301, "/");
    if (req.path !== "/" && /\/+$/ .test(req.path)) {
      const query = req.originalUrl.slice(req.path.length);
      const target = (req.path.replace(/\/+$/, "") || "/").replace(/^\/\/+/, "/");
      return res.redirect(301, target + query);
    }
    next();
  });

  app.use(express.static(distPath, {
    index: false,
    redirect: false,
    setHeaders: (res, filePath) => {
      const urlPath = `/${path.relative(distPath, filePath).split(path.sep).join("/")}`;
      res.setHeader("Cache-Control", staticCacheControl(urlPath));
    },
  }));
  app.use("*", async (req, res) => {
    const templatePath = path.resolve(distPath, "index.html");
    try {
      const template = await fs.promises.readFile(templatePath, "utf-8");
      const { render } = await import(serverEntryPath);
      const { html, dehydratedState, head } = await render(req.originalUrl);
      res.status(head.notFound ? 404 : 200).set("Cache-Control", "no-cache").type("html").end(composeHtml(template, html, head, dehydratedState));
    } catch (error) {
      console.error("[SSR] render failed, serving client shell:", error);
      const template = await fs.promises.readFile(templatePath, "utf-8");
      const fallback: HeadMeta = {
        title: "Ремонт квартир под ключ в Москве — Классный Ремонт",
        description: "Классный Ремонт — ремонт квартир бизнес- и премиум-класса в Москве.",
        noindex: true,
      };
      res.status(200).set("Cache-Control", "no-cache").type("html").end(
        template.replace("<!--app-head-->", () => buildHeadTags(fallback)).replace("<!--app-html-->", () => "")
      );
    }
  });
}
