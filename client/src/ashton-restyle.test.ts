import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

describe("Ashton editorial restyle", () => {
  it("defines the parchment, ink, and wine palette", () => {
    expect(css).toContain("--ink: #262626");
    expect(css).toContain("--cream: #e0ded8");
    expect(css).toContain("--ink-deep: #38141b");
  });

  it("applies editorial typography and sharp image treatment", () => {
    expect(css).toContain("font-family: Georgia, \"Times New Roman\", serif");
    expect(css).toContain(".project-card { border-radius: 0; }");
    expect(css).toContain(".blog-card { background: #fff; border: 1px solid");
  });
});
