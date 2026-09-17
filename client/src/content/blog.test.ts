import { describe, expect, it } from "vitest";
import { blogPosts, getBlogPost, getBlogPostFromPath } from "./blog";
import { prefetchForPath } from "../ssr/prefetch";

describe("SEO blog content", () => {
  it("publishes a focused cluster of practical and geo articles", () => {
    expect(blogPosts).toHaveLength(10);
    expect(blogPosts.map(post => post.slug)).toEqual(expect.arrayContaining([
      "stoimost-remonta-kvartiry-v-moskve-2026",
      "sroki-remonta-kvartiry-po-etapam",
      "priemka-kvartiry-v-novostroyke-chek-list",
      "remont-v-zhk-very-na-botanicheskoy",
      "remont-v-zhk-ever-v-moskve",
      "remont-v-zhk-ostrov-v-moskve",
      "remont-v-zhk-level-v-moskve",
      "remont-v-zhk-simvol-v-moskve",
      "remont-v-zhk-river-park-kolomenskoe",
      "remont-v-zhk-zilart-v-moskve",
    ]));
  });

  it("includes dated direct answers, sources, and reader-safe caveats", () => {
    for (const post of blogPosts) {
      expect(post.directAnswer.length).toBeGreaterThan(120);
      expect(post.modifiedAt).toBe("2026-09-17");
      expect(post.sources.length).toBeGreaterThanOrEqual(2);
      expect(post.faqs.length).toBeGreaterThanOrEqual(2);
      expect(post.disclaimer).toBeTruthy();
    }
  });

  it("creates crawlable article metadata and schema for every post", () => {
    for (const post of blogPosts) {
      const meta = prefetchForPath(post.path);
      expect(meta.notFound).not.toBe(true);
      expect(meta.ogType).toBe("article");
      expect(meta.canonicalPath).toBe(post.path);
      expect(meta.title).toContain(post.title);
      expect(JSON.stringify(meta.structuredData)).toContain("BlogPosting");
      expect(JSON.stringify(meta.structuredData)).toContain("FAQPage");
    }
  });

  it("resolves indexable post paths but not arbitrary blog slugs", () => {
    const valid = blogPosts[0]!;
    expect(getBlogPost(valid.slug)).toEqual(valid);
    expect(getBlogPostFromPath(valid.path)).toEqual(valid);
    expect(getBlogPostFromPath("/blog/no-such-article")).toBeUndefined();
  });

  it("does not represent geo articles as proof of completed repair work", () => {
    const geoPosts = blogPosts.filter(post => post.category === "ЖК Москвы");
    expect(geoPosts).toHaveLength(7);
    for (const post of geoPosts) {
      expect(post.disclaimer).toMatch(/не подтверждает|не заменяет|не является/);
    }
  });
});
