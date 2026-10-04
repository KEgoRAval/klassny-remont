import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { goalForLink, installContactGoals, reachGoal, reachLeadGoal, trackPageView, YANDEX_METRIKA_ID } from "./metrika";

function fakeBrowser({ counterLoaded = true } = {}) {
  const calls: unknown[][] = [];
  const listeners: Array<(event: unknown) => void> = [];
  const win: { ym?: (...args: unknown[]) => void } = counterLoaded ? { ym: (...args) => calls.push(args) } : {};
  const doc = {
    addEventListener: (_type: string, handler: (event: unknown) => void) => {
      listeners.push(handler);
    },
    removeEventListener: (_type: string, handler: (event: unknown) => void) => {
      const index = listeners.indexOf(handler);
      if (index >= 0) listeners.splice(index, 1);
    },
  };
  const click = (href: string | null) =>
    listeners.forEach(listener => listener({ target: { closest: () => (href === null ? null : { getAttribute: () => href }) } }));
  return { win, doc, calls, listeners, click };
}

const source = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");
const html = source("client/index.html");

describe("Yandex Metrika counter in the page shell", () => {
  it("loads the Klassny Remont counter on every page, for every visitor", () => {
    expect(YANDEX_METRIKA_ID).toBe(113397509);
    expect(html).toContain("https://mc.yandex.ru/metrika/tag.js?id=113397509");
    expect(html).toContain(
      `ym(113397509, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});`,
    );
  });

  it("uses one counter number everywhere", () => {
    const ids = new Set([...html.matchAll(/(?:tag\.js\?id=|ym\(|watch\/)(\d+)/g)].map(match => match[1]));
    expect([...ids]).toEqual([String(YANDEX_METRIKA_ID)]);
  });

  it("places the counter in the head ahead of styles and the application script", () => {
    const head = html.slice(html.indexOf("<head>"), html.indexOf("</head>"));
    const counterAt = head.indexOf("mc.yandex.ru/metrika/tag.js");
    expect(counterAt).toBeGreaterThan(0);
    expect(counterAt).toBeLessThan(head.indexOf("<style>"));
    expect(html.indexOf("mc.yandex.ru/metrika/tag.js")).toBeLessThan(html.indexOf("/src/entry-client.tsx"));
  });

  it("keeps the no-JavaScript pixel inside the body", () => {
    const body = html.slice(html.indexOf("<body>"), html.indexOf("</body>"));
    expect(body).toContain('<noscript><div><img src="https://mc.yandex.ru/watch/113397509"');
  });
});

describe("Metrika goals", () => {
  it("records a goal on the site counter", () => {
    const { win, calls } = fakeBrowser();

    reachGoal("lead", win);

    expect(calls).toEqual([[113397509, "reachGoal", "lead"]]);
  });

  it("records a submitted form as the common lead goal plus the goal of that form", () => {
    const { win, calls } = fakeBrowser();

    reachLeadGoal("lead_blog", win);

    expect(calls).toEqual([
      [113397509, "reachGoal", "lead"],
      [113397509, "reachGoal", "lead_blog"],
    ]);
  });

  it("does nothing when the counter script is blocked or has not loaded", () => {
    const { win } = fakeBrowser({ counterLoaded: false });

    expect(() => reachGoal("lead", win)).not.toThrow();
    expect(() => trackPageView("/blog", win)).not.toThrow();
  });

  it("reports an in-site navigation as a page view", () => {
    const { win, calls } = fakeBrowser();

    trackPageView("/blog", win);

    expect(calls).toEqual([[113397509, "hit", "/blog"]]);
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

  it("records a click on a phone link as a goal", () => {
    const { win, doc, calls, click } = fakeBrowser();
    installContactGoals(doc, win);

    click("tel:+79779480672");

    expect(calls).toEqual([[113397509, "reachGoal", "click_phone"]]);
  });

  it("ignores clicks that are not on contact links", () => {
    const { win, doc, calls, click } = fakeBrowser();
    installContactGoals(doc, win);

    click("/blog");
    click(null);

    expect(calls).toEqual([]);
  });

  it("stops listening when asked to", () => {
    const { win, doc, calls, click } = fakeBrowser();
    const stop = installContactGoals(doc, win);

    stop();
    click("tel:+79779480672");

    expect(calls).toEqual([]);
  });
});

describe("Metrika wiring in the site", () => {
  it("records a lead goal from each of the three forms", () => {
    const home = source("client/src/pages/Home.tsx");
    expect(home).toContain('reachLeadGoal("lead_calculator")');
    expect(home).toContain('reachLeadGoal("lead_contact")');
    expect(source("client/src/pages/Blog.tsx")).toContain('reachLeadGoal("lead_blog")');
  });

  it("reports in-site navigation and contact clicks from the head manager", () => {
    const head = source("client/src/components/Head.tsx");
    expect(head).toContain("trackPageView(");
    expect(head).toContain("installContactGoals(");
  });

  it("lets session recordings show what visitors type into the lead forms, as the owner decided", () => {
    for (const [file, fields] of [["client/src/pages/Home.tsx", 4], ["client/src/pages/Blog.tsx", 2]] as const) {
      const page = source(file);
      expect(page.split('<input className="ym-record-keys" value={').length - 1, file).toBe(fields);
      expect(page, file).not.toContain("<input value={");
      expect(page, file).not.toContain("ym-disable-keys");
    }
  });
});
