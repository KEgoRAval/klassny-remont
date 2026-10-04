import type { Express } from "express";

const ONE_YEAR = "public, max-age=31536000, immutable";
const ONE_MONTH = "public, max-age=2592000";
const ONE_HOUR = "public, max-age=3600";

/**
 * Cache lifetime for a file served from the public build directory.
 * Bundles in /assets carry a content hash and images in /media get a new name
 * when replaced, so both can be kept for a year. Font names are stable.
 */
export function staticCacheControl(urlPath: string): string {
  if (urlPath.startsWith("/assets/") || urlPath.startsWith("/media/")) return ONE_YEAR;
  if (urlPath.startsWith("/fonts/")) return ONE_MONTH;
  return ONE_HOUR;
}

/**
 * Images and fonts used to be fetched from Manus storage through
 * /manus-storage/<key>. They now ship with the site; these are the old keys
 * that search engines or link previews may still hold.
 */
const legacyStorageTargets: Record<string, string> = {
  "hero-living-room_277d141a.jpg": "/media/og/hero-living-room_277d141a.jpg",
  "very-enhanced-living_6019bd19.png": "/media/very-enhanced-living_6019bd19.webp",
  "very-enhanced-entry_0f41baa0.png": "/media/very-enhanced-entry_0f41baa0.webp",
  "very-enhanced-bedroom_262c2040.png": "/media/very-enhanced-bedroom_262c2040.webp",
  "very-enhanced-bathroom_c918e00d.png": "/media/very-enhanced-bathroom_c918e00d.webp",
  "ever-enhanced-living_6eb96fe0.png": "/media/ever-enhanced-living_6eb96fe0.webp",
  "ever-enhanced-entry_054ed219.png": "/media/ever-enhanced-entry_054ed219.webp",
  "ever-enhanced-bedroom_5f368637.png": "/media/ever-enhanced-bedroom_5f368637.webp",
  "ever-enhanced-shower_967e9d92.png": "/media/ever-enhanced-shower_967e9d92.webp",
  "6NUh8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0K7iN7hzFUPJH58nib1603gg7S2nfgRYIctxujDg_c41b47ed.ttf": "/fonts/fraunces-400.woff2",
  "6NUh8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0K7iN7hzFUPJH58nib1603gg7S2nfgRYIchRujDg_6d736901.ttf": "/fonts/fraunces-500.woff2",
  "6NUh8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0K7iN7hzFUPJH58nib1603gg7S2nfgRYIcaRyjDg_97744e70.ttf": "/fonts/fraunces-600.woff2",
  "6NUh8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0K7iN7hzFUPJH58nib1603gg7S2nfgRYIcUByjDg_30f58a38.ttf": "/fonts/fraunces-700.woff2",
  "xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk79FO_F_f08374ed.ttf": "/fonts/manrope-400.woff2",
  "xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk7PFO_F_bfd7bd4e.ttf": "/fonts/manrope-500.woff2",
  "xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk4jE-_F_bdaabe69.ttf": "/fonts/manrope-600.woff2",
  "xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk4aE-_F_fb60ae34.ttf": "/fonts/manrope-700.woff2",
  "xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk59E-_F_a7300312.ttf": "/fonts/manrope-800.woff2",
};

export function legacyStorageTarget(key: string): string | undefined {
  return Object.hasOwn(legacyStorageTargets, key) ? legacyStorageTargets[key] : undefined;
}

export function registerLegacyStorageRedirects(app: Express) {
  app.get("/manus-storage/*", (req, res) => {
    const key = (req.params as Record<string, string>)[0] ?? "";
    const target = legacyStorageTarget(key);
    if (!target) {
      res.status(404).type("text/plain").send("Not found");
      return;
    }
    res.redirect(301, target);
  });
}
