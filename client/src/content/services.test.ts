import { describe, expect, it } from "vitest";
import { prefetchForPath } from "../ssr/prefetch";
import { ORGANIZATION_ID } from "./organization";
import { getServicePageFromPath, servicePages } from "./services";

type Node = Record<string, unknown>;

describe("service landing pages", () => {
  it("has the two pages at their SEO paths", () => {
    expect(servicePages.map(page => page.path)).toEqual(["/remont-po-dizayn-proektu", "/dizayn-proekt"]);
    expect(getServicePageFromPath("/dizayn-proekt")?.slug).toBe("dizayn-proekt");
    expect(getServicePageFromPath("/dizayn")).toBeUndefined();
  });

  it.each(servicePages)("server-renders $path with its own head and service schema", page => {
    const head = prefetchForPath(page.path);
    expect(head.notFound).toBeFalsy();
    expect(head.title).toBe(page.title);
    expect(head.canonicalPath).toBe(page.path);
    expect(page.title.length).toBeLessThanOrEqual(90);
    expect(page.description.length).toBeLessThanOrEqual(170);
    const nodes = (head.structuredData as { "@graph": Node[] })["@graph"];
    expect(nodes.find(node => node["@type"] === "Service")).toMatchObject({ provider: { "@id": ORGANIZATION_ID } });
    expect(nodes.find(node => node["@type"] === "FAQPage")).toBeDefined();
  });

  it("names no price but the agreed «от 40 000 ₽/м²»", () => {
    const text = JSON.stringify(servicePages);
    const prices = text.match(/\d[\d\s ]*\s?₽/g) ?? [];
    for (const price of prices) expect(price.replace(/\s| /g, "")).toBe("40000₽");
  });
});
