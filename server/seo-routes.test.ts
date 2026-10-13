import express from "express";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { blogPosts } from "../client/src/content/blog";
import { HOME_UPDATED_AT, registerSeoRoutes } from "./_core/seo";

describe("robots.txt and sitemap.xml", () => {
  const app = express();
  registerSeoRoutes(app);
  let origin = "";
  let close: () => void = () => {};
  const previousOrigin = process.env.CANONICAL_ORIGIN;

  beforeAll(async () => {
    process.env.CANONICAL_ORIGIN = "https://krem.moscow";
    await new Promise<void>(done => {
      const server = app.listen(0, "127.0.0.1", () => {
        origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
        close = () => server.close();
        done();
      });
    });
  });
  afterAll(() => {
    close();
    process.env.CANONICAL_ORIGIN = previousOrigin;
  });

  it("closes /api/ for every crawler group, since a named crawler ignores the * group", async () => {
    const robots = await fetch(`${origin}/robots.txt`).then(r => r.text());
    const groups = robots.split(/\n(?=User-agent:)/).filter(group => group.startsWith("User-agent:"));

    expect(groups.map(group => group.split("\n")[0])).toEqual(expect.arrayContaining(["User-agent: *", "User-agent: YandexBot", "User-agent: GPTBot"]));
    for (const group of groups) expect(group, group.split("\n")[0]).toContain("Disallow: /api/");
    expect(robots).toContain("Sitemap: https://krem.moscow/sitemap.xml");
  });

  it("keeps lastmod stable between requests: home by its update date, blog by its newest post", async () => {
    const first = await fetch(`${origin}/sitemap.xml`).then(r => r.text());
    const second = await fetch(`${origin}/sitemap.xml`).then(r => r.text());
    const newestPost = blogPosts.map(post => post.modifiedAt).sort().at(-1);

    expect(first).toBe(second);
    expect(first).toContain(`<loc>https://krem.moscow/</loc><lastmod>${HOME_UPDATED_AT}</lastmod>`);
    expect(first).toContain(`<loc>https://krem.moscow/blog</loc><lastmod>${newestPost}</lastmod>`);
    expect(first.match(/<url>/g)).toHaveLength(blogPosts.length + 2);
  });
});
