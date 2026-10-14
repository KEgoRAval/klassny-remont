import { describe, expect, it } from "vitest";
import { MAX_AREA, PROPERTY_TYPES, clampArea, estimateRange } from "./maxQuiz";

describe("MAX mini-app estimate", () => {
  it("never shows less than the 40 000 ₽/м² the site promises", () => {
    for (const type of PROPERTY_TYPES) {
      expect(type.rateFrom).toBeGreaterThanOrEqual(40_000);
      expect(type.rateTo).toBeGreaterThan(type.rateFrom);
    }
  });

  it("gives a range rounded to 10 000 ₽", () => {
    expect(estimateRange(57, "new-bare")).toEqual({ from: 2_280_000, to: 2_620_000 });
    expect(estimateRange(100, "secondary")).toEqual({ from: 4_400_000, to: 5_200_000 });
  });

  it("keeps the area within what the server accepts", () => {
    expect(clampArea(5)).toBe(MAX_AREA.min);
    expect(clampArea(1000)).toBe(MAX_AREA.max);
    expect(clampArea(Number.NaN)).toBe(MAX_AREA.initial);
    expect(MAX_AREA.min).toBeGreaterThanOrEqual(20);
    expect(MAX_AREA.max).toBeLessThanOrEqual(400);
  });
});
