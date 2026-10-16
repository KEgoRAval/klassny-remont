import { describe, expect, it } from "vitest";
import { maxEntry, maxStartParam } from "./maxEntry";

describe("MAX mini-app entry point", () => {
  it("reads the channel deep link from initData", () => {
    const init = "auth_date=1&start_param=channel&hash=x";
    expect(maxStartParam(init, "")).toBe("channel");
    expect(maxEntry(init, { search: "", hash: "" })).toBe("channel");
  });

  it("reads it from the fragment when the bridge has no initData field", () => {
    expect(maxEntry("auth_date=1&hash=x", { search: "", hash: "#WebAppData=x&WebAppStartParam=channel" })).toBe("channel");
  });

  it("marks the site fallback of the channel button", () => {
    expect(maxEntry(undefined, { search: "?utm_source=max_channel", hash: "" })).toBe("channel");
  });

  it("tells the bot from a plain browser", () => {
    expect(maxEntry("auth_date=1&hash=x", { search: "", hash: "" })).toBe("bot");
    expect(maxEntry(undefined, { search: "", hash: "" })).toBe("browser");
  });
});
