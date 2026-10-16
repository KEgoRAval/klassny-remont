import { describe, expect, it } from "vitest";
import { extractQuantities } from "./extract";

const file = { bytes: new Uint8Array([37, 80, 68, 70]), mimeType: "application/pdf" };
const config = { apiKey: "test", model: "claude-opus-5-5" };
const input = { object: "Тест", address: "", area: 57, ceiling: 2.7, floorCoveringKnown: true, quantities: [], assumptions: [], notIncluded: [], missingSheets: [] };

describe("estimate extraction request", () => {
  it("does not force tool_choice, which current models reject", async () => {
    const bodies: Record<string, unknown>[] = [];
    const fetcher = (async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ content: [{ type: "tool_use", name: "submit_quantities", input }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const result = await extractQuantities(file, fetcher, config);
    expect(result.area).toBe(57);
    expect(bodies[0].tool_choice).toEqual({ type: "auto" });
  });

  it("asks once more when the model answers in prose", async () => {
    const bodies: { messages: { role: string }[] }[] = [];
    const fetcher = (async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      const content = bodies.length === 1
        ? [{ type: "text", text: "Сейчас посчитаю." }]
        : [{ type: "tool_use", name: "submit_quantities", input }];
      return new Response(JSON.stringify({ content }), { status: 200 });
    }) as unknown as typeof fetch;
    await extractQuantities(file, fetcher, config);
    expect(bodies).toHaveLength(2);
    expect(bodies[1].messages.map(m => m.role)).toEqual(["user", "assistant", "user"]);
  });

  it("gives up after the second prose answer", async () => {
    const fetcher = (async () => new Response(JSON.stringify({ content: [{ type: "text", text: "нет" }] }), { status: 200 })) as unknown as typeof fetch;
    await expect(extractQuantities(file, fetcher, config)).rejects.toThrow("returned no quantities");
  });
});
