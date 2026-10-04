import express from "express";
import { existsSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { legacyStorageTarget, registerLegacyStorageRedirects, staticCacheControl } from "./_core/staticAssets";

const publicDir = resolve(process.cwd(), "client/public");

describe("static asset caching", () => {
  it("lets browsers keep fingerprinted bundles and images for a year", () => {
    expect(staticCacheControl("/assets/index-CTCUnoaX.js")).toBe("public, max-age=31536000, immutable");
    expect(staticCacheControl("/media/very-enhanced-living_6019bd19.webp")).toBe("public, max-age=31536000, immutable");
    expect(staticCacheControl("/media/og/hero-living-room_277d141a.jpg")).toBe("public, max-age=31536000, immutable");
  });

  it("caches fonts for a month because their names carry no fingerprint", () => {
    expect(staticCacheControl("/fonts/manrope-400.woff2")).toBe("public, max-age=2592000");
  });

  it("keeps other public files on a short lifetime", () => {
    expect(staticCacheControl("/llms.txt")).toBe("public, max-age=3600");
  });
});

describe("legacy Manus storage addresses", () => {
  it("points an old picture address at the local picture", () => {
    expect(legacyStorageTarget("very-enhanced-living_6019bd19.png")).toBe("/media/very-enhanced-living_6019bd19.webp");
  });

  it("points the old hero address at its JPEG preview, the format link scrapers expect", () => {
    expect(legacyStorageTarget("hero-living-room_277d141a.jpg")).toBe("/media/og/hero-living-room_277d141a.jpg");
  });

  it("points an old font address at the local font", () => {
    expect(legacyStorageTarget("xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk79FO_F_f08374ed.ttf")).toBe("/fonts/manrope-400.woff2");
  });

  it("knows nothing about files that were never on the site", () => {
    expect(legacyStorageTarget("project-cobalt.jpg")).toBeUndefined();
    expect(legacyStorageTarget("../../etc/passwd")).toBeUndefined();
  });

  it("only redirects to files that are shipped in the project", () => {
    for (const key of [
      "ever-enhanced-bedroom_5f368637.png",
      "ever-enhanced-entry_054ed219.png",
      "ever-enhanced-living_6eb96fe0.png",
      "ever-enhanced-shower_967e9d92.png",
      "hero-living-room_277d141a.jpg",
      "very-enhanced-bathroom_c918e00d.png",
      "very-enhanced-bedroom_262c2040.png",
      "very-enhanced-entry_0f41baa0.png",
      "very-enhanced-living_6019bd19.png",
    ]) {
      const target = legacyStorageTarget(key);
      expect(target, key).toBeDefined();
      expect(existsSync(resolve(publicDir, target!.slice(1))), target).toBe(true);
    }
  });

  describe("over HTTP", () => {
    const app = express();
    registerLegacyStorageRedirects(app);
    let origin = "";
    let close: () => void = () => {};

    beforeAll(async () => {
      await new Promise<void>(done => {
        const server = app.listen(0, "127.0.0.1", () => {
          origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
          close = () => server.close();
          done();
        });
      });
    });
    afterAll(() => close());

    it("answers a known old address with a permanent redirect and no call to Manus", async () => {
      const response = await fetch(`${origin}/manus-storage/very-enhanced-entry_0f41baa0.png`, { redirect: "manual" });
      expect(response.status).toBe(301);
      expect(response.headers.get("location")).toBe("/media/very-enhanced-entry_0f41baa0.webp");
    });

    it("answers an unknown old address with 404", async () => {
      const response = await fetch(`${origin}/manus-storage/nothing-here.png`, { redirect: "manual" });
      expect(response.status).toBe(404);
    });
  });
});
