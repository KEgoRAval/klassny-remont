import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const publicDir = resolve(process.cwd(), "client/public");
const home = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

describe("project videos on the home page", () => {
  it("ships the ЖК Very walkthrough as a light web video", () => {
    const file = resolve(publicDir, "media/video/very-walkthrough.mp4");
    expect(existsSync(file)).toBe(true);
    expect(statSync(file).size).toBeLessThan(6 * 1024 * 1024);
    expect(home).toContain('src: "/media/video/very-walkthrough.mp4"');
  });

  it("ships the ЖК Ever walkthrough as a light web video", () => {
    const file = resolve(publicDir, "media/video/ever-walkthrough.mp4");
    expect(existsSync(file)).toBe(true);
    expect(statSync(file).size).toBeLessThan(6 * 1024 * 1024);
    expect(home).toContain('src: "/media/video/ever-walkthrough.mp4"');
  });

  it("ships the ЖК Остров walkthrough as a light web video", () => {
    const file = resolve(publicDir, "media/video/ostrov-walkthrough.mp4");
    expect(existsSync(file)).toBe(true);
    expect(statSync(file).size).toBeLessThan(6 * 1024 * 1024);
    expect(existsSync(resolve(publicDir, "media/video/ostrov-walkthrough-poster.jpg"))).toBe(true);
    expect(home).toContain('src: "/media/video/ostrov-walkthrough.mp4"');
  });

  it("no longer shows the reviews block", () => {
    expect(home).not.toContain("Отзывы клиентов");
    expect(home).not.toContain("k-quote");
  });
});
