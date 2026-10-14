import { describe, expect, it } from "vitest";
import { MAX_AREA, WORK_RATE_FROM, clampArea, estimateFrom } from "./maxQuiz";

describe("MAX mini-app estimate", () => {
  it("shows the same 40 000 ₽/м² as the rest of the site", () => {
    expect(WORK_RATE_FROM).toBe(40_000);
    expect(estimateFrom(38)).toBe(1_520_000);
  });

  it("keeps the area within what the server accepts", () => {
    expect(clampArea(5)).toBe(MAX_AREA.min);
    expect(clampArea(1000)).toBe(MAX_AREA.max);
    expect(clampArea(Number.NaN)).toBe(MAX_AREA.initial);
    expect(MAX_AREA.min).toBeGreaterThanOrEqual(20);
    expect(MAX_AREA.max).toBeLessThanOrEqual(400);
  });
});
