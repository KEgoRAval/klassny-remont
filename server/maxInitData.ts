import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Checks the launch data MAX gives the /max mini-app (window.WebApp.initData, also the
 * WebAppData parameter of the URL fragment) and returns the MAX user id it vouches for.
 * Only a verified id may receive an estimate from the bot; anything else gets null.
 *
 * Algorithm (dev.max.ru, mini-app validation): secret = HMAC-SHA256(key "WebAppData", bot token);
 * data-check string = pairs except hash, URL-decoded, sorted by key, "key=value" joined by "\n";
 * hash = hex HMAC-SHA256(key secret, data-check string).
 */
export function verifyMaxInitData(
  initData: string | null | undefined,
  botToken: string,
  now: number = Date.now(),
  maxAgeSeconds = 24 * 60 * 60,
): { userId: number; firstName?: string } | null {
  if (!initData || !botToken || initData.length > 4096) return null;
  const pairs: [string, string][] = [];
  let hash: string | null = null;
  for (const part of initData.split("&")) {
    const index = part.indexOf("=");
    if (index <= 0) continue;
    const key = part.slice(0, index);
    let value: string;
    try {
      value = decodeURIComponent(part.slice(index + 1).replace(/\+/g, "%20"));
    } catch {
      return null;
    }
    if (key === "hash") {
      if (hash !== null) return null;
      hash = value;
    } else {
      pairs.push([key, value]);
    }
  }
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) return null;

  const dataCheck = pairs.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(dataCheck).digest();
  const given = Buffer.from(hash, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  const fields = Object.fromEntries(pairs);
  const authDate = Number(fields.auth_date);
  if (Number.isFinite(authDate) && authDate > 0 && now / 1000 - authDate > maxAgeSeconds) return null;
  try {
    const user = JSON.parse(fields.user ?? "null") as { id?: number; first_name?: string } | null;
    if (!user || typeof user.id !== "number" || !Number.isSafeInteger(user.id)) return null;
    return { userId: user.id, firstName: user.first_name };
  } catch {
    return null;
  }
}
