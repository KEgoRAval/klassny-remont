/**
 * Yandex Metrika goals. The counter itself is the standard snippet in
 * client/index.html and loads on every page for every visitor; this module
 * only talks to it. The counter number here must match the one in the snippet.
 *
 * Session recording (Webvisor) is on, and by the owner's decision the name and
 * phone fields carry the ym-record-keys class, so recordings show what is typed
 * there. The privacy policy states this.
 *
 * Goals to create in the Metrika interface as "JavaScript event" goals:
 *   lead             — any form was submitted (use this one for Direct)
 *   lead_calculator  — "Запишитесь на замер" from the calculator
 *   lead_contact     — contact form at the bottom of the home page
 *   lead_blog        — estimate form on a residential-complex article
 *   click_phone, click_telegram, click_whatsapp — clicks on contact links
 */
export const YANDEX_METRIKA_ID = 113397509;

export type MetrikaGoal =
  | "lead"
  | "lead_calculator"
  | "lead_contact"
  | "lead_blog"
  | "click_phone"
  | "click_telegram"
  | "click_whatsapp";

type MetrikaWindow = { ym?: (...args: unknown[]) => void };
type ClickEvent = { target?: { closest?: (selector: string) => { getAttribute(name: string): string | null } | null } | null };
type MetrikaDocument = {
  addEventListener(type: string, handler: (event: never) => void, options?: unknown): void;
  removeEventListener(type: string, handler: (event: never) => void, options?: unknown): void;
};

const browserWindow = () => window as unknown as MetrikaWindow;
const browserDocument = () => document as unknown as MetrikaDocument;

export function goalForLink(href: string | null | undefined): MetrikaGoal | undefined {
  if (!href) return undefined;
  if (href.startsWith("tel:")) return "click_phone";
  if (/^https?:\/\/(t\.me|telegram\.me)\//.test(href)) return "click_telegram";
  if (/^https?:\/\/(wa\.me|api\.whatsapp\.com)\//.test(href)) return "click_whatsapp";
  return undefined;
}

/** Records a goal. Does nothing if the counter script is blocked or not loaded. */
export function reachGoal(goal: MetrikaGoal, win: MetrikaWindow = browserWindow()): void {
  win.ym?.(YANDEX_METRIKA_ID, "reachGoal", goal);
}

/** A submitted form: the common "lead" goal plus the goal of the specific form. */
export function reachLeadGoal(form: "lead_calculator" | "lead_contact" | "lead_blog", win: MetrikaWindow = browserWindow()): void {
  reachGoal("lead", win);
  reachGoal(form, win);
}

/** Page view for a navigation that did not reload the page. */
export function trackPageView(url: string, win: MetrikaWindow = browserWindow()): void {
  win.ym?.(YANDEX_METRIKA_ID, "hit", url);
}

/** Records clicks on phone, Telegram and WhatsApp links as goals. Returns a function that stops it. */
export function installContactGoals(doc: MetrikaDocument = browserDocument(), win: MetrikaWindow = browserWindow()): () => void {
  const onClick = (event: ClickEvent) => {
    const link = event.target?.closest?.("a[href]");
    const goal = goalForLink(link?.getAttribute("href"));
    if (goal) reachGoal(goal, win);
  };
  const handler = onClick as (event: never) => void;
  doc.addEventListener("click", handler, { capture: true });
  return () => doc.removeEventListener("click", handler, { capture: true });
}
