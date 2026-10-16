/**
 * Where a lead of the MAX mini-app came from:
 * - "channel" — the button under a post in the MAX channel (deep link ?startapp=channel, or the
 *   site fallback /max?utm_source=max_channel when the bot's nick is not configured);
 * - "bot" — opened inside MAX from the bot itself;
 * - "browser" — the /max page opened in an ordinary browser.
 */
export type MaxEntry = "channel" | "bot" | "browser";

/** The start parameter MAX passes to the mini-app: start_param inside initData, or WebAppStartParam in the fragment. */
export function maxStartParam(initData: string | undefined, hash: string): string | undefined {
  try {
    const fromInit = initData ? new URLSearchParams(initData).get("start_param") : null;
    if (fromInit) return fromInit;
    return new URLSearchParams(hash.replace(/^#/, "")).get("WebAppStartParam") ?? undefined;
  } catch {
    return undefined;
  }
}

export function maxEntry(initData: string | undefined, url: { search: string; hash: string }): MaxEntry {
  const start = maxStartParam(initData, url.hash);
  if (start === "channel") return "channel";
  const query = new URLSearchParams(url.search);
  if (query.get("utm_source") === "max_channel" || query.get("startapp") === "channel") return "channel";
  return initData ? "bot" : "browser";
}

export const MAX_ENTRY_LABEL: Record<MaxEntry, string> = {
  channel: "из канала",
  bot: "из бота",
  browser: "страница /max в браузере",
};
