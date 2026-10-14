import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { prefetchForPath } from "../ssr/prefetch";
import { blogPosts } from "./blog";
import { ORGANIZATION_ID, organizationLogo } from "./organization";

type Node = Record<string, unknown>;
const graph = (path: string) => (prefetchForPath(path).structuredData as { "@graph"?: Node[] })["@graph"] ?? [];

describe("organization structured data", () => {
  it("describes the company on the home page without a self-served rating", () => {
    const nodes = graph("/");
    const org = nodes.find(node => node["@id"] === ORGANIZATION_ID);
    expect(org).toBeDefined();
    expect(org).not.toHaveProperty("aggregateRating");
    expect(org?.logo).toEqual(organizationLogo);
    expect(org?.image).toMatch(/^\/media\/og\/.+\.jpg$/);
    expect(JSON.stringify(nodes)).not.toContain("AggregateRating");
  });

  it("adds a WebSite node published by the organization", () => {
    const site = graph("/").find(node => node["@type"] === "WebSite");
    expect(site).toMatchObject({ "@id": "/#website", url: "/", publisher: { "@id": ORGANIZATION_ID } });
  });

  it("uses a root-relative id so SSR turns it into an absolute URL", () => {
    expect(ORGANIZATION_ID).toBe("/#organization");
  });

  it("ships the logo file", () => {
    expect(existsSync(resolve(process.cwd(), "client/public", organizationLogo.url.slice(1)))).toBe(true);
  });

  it("links every article's author and publisher to the same organization", () => {
    for (const post of blogPosts) {
      const article = graph(post.path).find(node => node["@type"] === "BlogPosting");
      expect(article?.author, post.slug).toMatchObject({ "@id": ORGANIZATION_ID });
      expect(article?.publisher, post.slug).toMatchObject({ "@id": ORGANIZATION_ID, logo: organizationLogo });
    }
  });
});
