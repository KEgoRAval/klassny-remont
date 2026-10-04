import { describe, expect, it } from "vitest";
import { createPlugins } from "../vite.config";

const pluginNames = (isProduction: boolean) =>
  createPlugins(isProduction)
    .flat()
    .map(plugin => (plugin && typeof plugin === "object" && "name" in plugin ? plugin.name : ""));

describe("client build plugins", () => {
  it("keeps the Manus editor runtime out of the production bundle", () => {
    expect(pluginNames(true)).not.toContain("vite-plugin-manus-runtime");
  });

  it("does not stamp source file locations onto production markup", () => {
    expect(pluginNames(true)).not.toContain("vite-plugin-jsx-loc");
  });

  it("keeps the debug collector out of the production bundle", () => {
    expect(pluginNames(true)).not.toContain("manus-debug-collector");
  });

  it("keeps the Manus tooling available in development", () => {
    expect(pluginNames(false)).toEqual(
      expect.arrayContaining(["vite-plugin-manus-runtime", "vite-plugin-jsx-loc", "manus-debug-collector"]),
    );
  });
});
