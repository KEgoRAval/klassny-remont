import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { goalForLink, loadMetrika, metrikaCounterId, reachGoal, resetMetrikaForTests, trackPageView } from "./metrika";

type YmCall = unknown[];

function fakeBrowser() {
  const appended: Array<Record<string, unknown>> = [];
  const listeners: Record<string, (event: unknown) => void> = {};
  const doc = {
    createElement: () => ({}) as Record<string, unknown>,
    head: { appendChild: (node: Record<string, unknown>) => appended.push(node) },
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      listeners[type] = handler;
    },
  };
  const win: { ym?: ((...args: unknown[]) => void) & { a?: YmCall[] } } = {};
  const calls = () => (win.ym?.a ?? []).map(args => Array.from(args as ArrayLike<unknown>));
  return { win, doc, appended, listeners, calls };
}

const source = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

describe("Yandex Metrika counter id", () => {
  it("accepts a numeric counter id", () => {
    expect(metrikaCounterId("98765432")).toBe(98765432);
    expect(metrikaCounterId(" 98765432 ")).toBe(98765432);
  });

  it("treats a missing or malformed id as 'Metrika is off'", () => {
    for (const raw of [undefined, "", "0", "abc", "12.5", "-4"]) expect(metrikaCounterId(raw)).toBeUndefined();
  });
});

describe("Yandex Metrika loading", () => {
  beforeEach(() => resetMetrikaForTests());

  it("adds the Metrika script once and initialises the counter without session recording", () => {
    const { win, doc, appended, calls } = fakeBrowser();

    loadMetrika(98765432, win, doc);
    loadMetrika(98765432, win, doc);

    expect(appended).toHaveLength(1);
    expect(appended[0]).toMatchObject({ src: "https://mc.yandex.ru/metrika/tag.js", async: true });
    const init = calls().filter(call => call[1] === "init");
    expect(init).toHaveLength(1);
    expect(init[0][0]).toBe(98765432);
    expect(init[0][2]).toMatchObject({ clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: false });
  });

  it("records a goal after the counter is loaded", () => {
    const { win, doc, calls } = fakeBrowser();
    loadMetrika(98765432, win, doc);

    reachGoal("lead", win);

    expect(calls()).toContainEqual([98765432, "reachGoal", "lead"]);
  });

  it("records nothing while the visitor has not allowed analytics", () => {
    const { win } = fakeBrowser();

    expect(() => reachGoal("lead", win)).not.toThrow();
    expect(win.ym).toBeUndefined();
  });

  it("reports an in-site navigation as a page view", () => {
    const { win, doc, calls } = fakeBrowser();
    loadMetrika(98765432, win, doc);

    trackPageView("/blog", win);

    expect(calls()).toContainEqual([98765432, "hit", "/blog"]);
  });

  it("records contact clicks as goals once loaded", () => {
    const { win, doc, listeners, calls } = fakeBrowser();
    loadMetrika(98765432, win, doc);

    listeners.click?.({ target: { closest: () => ({ getAttribute: () => "tel:+79779480672" }) } });

    expect(calls()).toContainEqual([98765432, "reachGoal", "click_phone"]);
  });
});

describe("contact link goals", () => {
  it("maps contact links to goals", () => {
    expect(goalForLink("tel:+79779480672")).toBe("click_phone");
    expect(goalForLink("https://t.me/Klrem1_bot?start=site")).toBe("click_telegram");
    expect(goalForLink("https://wa.me/79779480672?text=hi")).toBe("click_whatsapp");
  });

  it("ignores ordinary links", () => {
    expect(goalForLink("/blog")).toBeUndefined();
    expect(goalForLink("#contacts")).toBeUndefined();
    expect(goalForLink(null)).toBeUndefined();
  });
});

describe("Metrika wiring in the site", () => {
  it("never loads Metrika from the HTML shell, only after a cookie choice", () => {
    expect(source("client/index.html")).not.toContain("mc.yandex.ru");
    const consent = source("client/src/components/CookieConsent.tsx");
    const loadAnalytics = consent.slice(consent.indexOf("function loadAnalytics"), consent.indexOf("export function CookieConsent"));
    expect(loadAnalytics).toContain("loadMetrika(");
  });

  it("records a lead goal from each of the three forms", () => {
    const home = source("client/src/pages/Home.tsx");
    expect(home).toContain('reachLeadGoal("lead_calculator")');
    expect(home).toContain('reachLeadGoal("lead_contact")');
    expect(source("client/src/pages/Blog.tsx")).toContain('reachLeadGoal("lead_blog")');
  });

  it("reports in-site navigation from the head manager", () => {
    expect(source("client/src/components/Head.tsx")).toContain("trackPageView(");
  });

  it("names Yandex Metrika in the cookie section of the policy", () => {
    expect(source("client/src/pages/Legal.tsx")).toContain("Яндекс Метрика");
  });
});
