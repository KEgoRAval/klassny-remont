/**
 * Yandex Metrika. The counter is loaded only after the visitor allows
 * analytics in the cookie notice (see CookieConsent), and nothing is recorded
 * before that. Session recording (Webvisor) stays off: the forms collect names
 * and phone numbers.
 *
 * Goals to create in the Metrika interface as "JavaScript event" goals:
 *   lead             — any form was submitted (use this one for Direct)
 *   lead_calculator  — "Запишитесь на замер" from the calculator
 *   lead_contact     — contact form at the bottom of the home page
 *   lead_blog        — estimate form on a residential-complex article
 *   click_phone, click_telegram, click_whatsapp — clicks on contact links
 */

/** Counter number from the Metrika interface. Empty string keeps Metrika off. */
export const YANDEX_METRIKA_ID: string = (import.meta.env?.VITE_YANDEX_METRIKA_ID as string | undefined) ?? "";

export type MetrikaGoal =
  | "lead"
  | "lead_calculator"
  | "lead_contact"
  | "lead_blog"
  | "click_phone"
  | "click_telegram"
  | "click_whatsapp";

type Ym = ((...args: unknown[]) => void) & { a?: unknown[][]; l?: number };
type MetrikaWindow = { ym?: Ym };
type MetrikaDocument = {
  createElement(tag: string): unknown;
  head: { appendChild(node: never): unknown };
  addEventListener(type: string, handler: (event: never) => void, options?: unknown): void;
};

const TAG_URL = "https://mc.yandex.ru/metrika/tag.js";

let activeCounterId: number | undefined;

const browserWindow = () => window as unknown as MetrikaWindow;
const browserDocument = () => document as unknown as MetrikaDocument;

export function metrikaCounterId(raw: string | undefined): number | undefined {
  const value = raw?.trim() ?? "";
  if (!/^[1-9]\d*$/.test(value)) return undefined;
  return Number(value);
}

export function goalForLink(href: string | null | undefined): MetrikaGoal | undefined {
  if (!href) return undefined;
  if (href.startsWith("tel:")) return "click_phone";
  if (/^https?:\/\/(t\.me|telegram\.me)\//.test(href)) return "click_telegram";
  if (/^https?:\/\/(wa\.me|api\.whatsapp\.com)\//.test(href)) return "click_whatsapp";
  return undefined;
}

export function loadMetrika(counterId: number, win: MetrikaWindow = browserWindow(), doc: MetrikaDocument = browserDocument()): void {
  if (activeCounterId !== undefined) return;
  activeCounterId = counterId;

  const queue: Ym = (...args: unknown[]) => {
    (queue.a = queue.a ?? []).push(args);
  };
  queue.l = Date.now();
  win.ym = win.ym ?? queue;

  const script = doc.createElement("script") as { src: string; async: boolean };
  script.async = true;
  script.src = TAG_URL;
  doc.head.appendChild(script as never);

  win.ym(counterId, "init", { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: false });

  doc.addEventListener(
    "click",
    ((event: { target?: { closest?: (selector: string) => { getAttribute(name: string): string | null } | null } }) => {
      const link = event.target?.closest?.("a[href]");
      const goal = goalForLink(link?.getAttribute("href"));
      if (goal) reachGoal(goal, win);
    }) as (event: never) => void,
    { capture: true },
  );
}

export function reachGoal(goal: MetrikaGoal, win: MetrikaWindow = browserWindow()): void {
  if (activeCounterId === undefined || !win.ym) return;
  win.ym(activeCounterId, "reachGoal", goal);
}

/** A submitted form: the common "lead" goal plus the goal of the specific form. */
export function reachLeadGoal(form: "lead_calculator" | "lead_contact" | "lead_blog", win: MetrikaWindow = browserWindow()): void {
  reachGoal("lead", win);
  reachGoal(form, win);
}

/** Page view for a navigation that did not reload the page. */
export function trackPageView(url: string, win: MetrikaWindow = browserWindow()): void {
  if (activeCounterId === undefined || !win.ym) return;
  win.ym(activeCounterId, "hit", url);
}

export function resetMetrikaForTests(): void {
  activeCounterId = undefined;
}
