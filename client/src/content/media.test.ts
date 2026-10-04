import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { prefetchForPath } from "../ssr/prefetch";
import { blogPosts } from "./blog";
import { ogImageFor, siteImages } from "./media";

const publicDir = resolve(process.cwd(), "client/public");
const onDisk = (urlPath: string) => existsSync(resolve(publicDir, urlPath.replace(/^\//, "")));
const source = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

describe("self-hosted media", () => {
  it("ships every site image inside the project", () => {
    const images = Object.values(siteImages);
    expect(images.length).toBeGreaterThanOrEqual(9);
    for (const image of images) {
      expect(image.src).toMatch(/^\/media\/[^/]+\.webp$/);
      expect(onDisk(image.src), image.src).toBe(true);
      expect(image.width).toBeGreaterThan(0);
      expect(image.height).toBeGreaterThan(0);
    }
  });

  it("ships the smaller hero rendition named in its srcSet", () => {
    const candidates = (siteImages.hero.srcSet ?? "").split(",").map(entry => entry.trim().split(" ")[0]);
    expect(candidates.length).toBe(2);
    for (const candidate of candidates) expect(onDisk(candidate), candidate).toBe(true);
  });

  it("maps a page image to its JPEG social preview", () => {
    expect(ogImageFor("/media/very-enhanced-living_6019bd19.webp")).toBe("/media/og/very-enhanced-living_6019bd19.jpg");
    expect(ogImageFor("/media/hero-living-room_277d141a-1920.webp")).toBe("/media/og/hero-living-room_277d141a.jpg");
  });

  it("gives every blog post a cover and a social preview that exist on disk", () => {
    for (const post of blogPosts) {
      expect(onDisk(post.image), post.image).toBe(true);
      const head = prefetchForPath(post.path);
      expect(head.ogImage).toBe(ogImageFor(post.image));
      expect(onDisk(head.ogImage ?? ""), head.ogImage).toBe(true);
    }
  });

  it("uses on-disk JPEG social previews for the home page and the blog index", () => {
    for (const path of ["/", "/blog"]) {
      const { ogImage } = prefetchForPath(path);
      expect(ogImage).toMatch(/^\/media\/og\/[^/]+\.jpg$/);
      expect(onDisk(ogImage ?? ""), ogImage).toBe(true);
    }
  });

  it("no longer loads images or fonts from Manus storage", () => {
    for (const file of [
      "client/index.html",
      "client/src/pages/Home.tsx",
      "client/src/pages/Blog.tsx",
      "client/src/content/blog.ts",
      "client/src/ssr/prefetch.ts",
      "client/src/index.css",
    ]) {
      expect(source(file), file).not.toContain("/manus-storage/");
    }
  });

  it("declares every font face from a woff2 file shipped in the project", () => {
    const fontUrls = [...source("client/index.html").matchAll(/url\("([^"]+)"\)/g)].map(match => match[1]);
    expect(fontUrls.length).toBe(9);
    for (const url of fontUrls) {
      expect(url).toMatch(/^\/fonts\/[a-z]+-\d{3}\.woff2$/);
      expect(onDisk(url), url).toBe(true);
    }
  });
});
