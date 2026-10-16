import { describe, expect, it } from "vitest";
import { prefetchForPath } from "../ssr/prefetch";
import { PRICE_LIST } from "../../../server/estimate/priceList";
import { ORGANIZATION_ID } from "./organization";
import { getServicePageFromPath, servicePages } from "./services";

type Node = Record<string, unknown>;

describe("service landing pages", () => {
  it("has the pages at their SEO paths", () => {
    expect(servicePages.map(page => page.path)).toEqual(["/remont-po-dizayn-proektu", "/dizayn-proekt", "/ceny", "/elitnyy-remont-kvartir", "/dizayneram"]);
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

  it("names no prices on the service pages but «от 40 000 ₽/м²» for works and «от 4 000 ₽/м²» for design", () => {
    const text = JSON.stringify(servicePages.filter(page => page.slug !== "ceny" && page.slug !== "dizayneram"));
    const prices = text.match(/\d[\d\s ]*\s?₽/g) ?? [];
    for (const price of prices) expect(["40000₽", "4000₽"]).toContain(price.replace(/\s| /g, ""));
  });

  it("takes the approximate prices on /ceny from the Level price list", () => {
    const table = getServicePageFromPath("/ceny")!.sections.find(section => section.heading === "Примерные цены на работы")!.table!;
    const listed = new Set(PRICE_LIST.map(item => item.price));
    // socket with its box, installation with the toilet, wallpaper (the owner's price, not in the list)
    const sums = new Set([950 + 1_250, 8_800 + 5_600, 1_300]);
    for (const [, price] of table.rows) {
      const value = Number(price.replace(/[^\d]/g, ""));
      expect(listed.has(value) || sums.has(value), price).toBe(true);
    }
  });
});
