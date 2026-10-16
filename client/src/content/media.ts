/**
 * Site images. The files live in client/public/media and are served by the
 * site itself with a long cache lifetime, so a replaced picture must get a new
 * file name. Each image has a 1200x630 JPEG twin in media/og for link previews.
 */
export type SiteImage = {
  src: string;
  width: number;
  height: number;
  srcSet?: string;
  sizes?: string;
};

export const siteImages = {
  hero: {
    src: "/media/hero-living-room_277d141a-1920.webp",
    width: 1920,
    height: 1080,
    srcSet: "/media/hero-living-room_277d141a-960.webp 960w, /media/hero-living-room_277d141a-1920.webp 1920w",
    sizes: "100vw",
  },
  veryLiving: { src: "/media/very-enhanced-living_6019bd19.webp", width: 1086, height: 1448 },
  veryEntry: { src: "/media/very-enhanced-entry_0f41baa0.webp", width: 1086, height: 1448 },
  veryBedroom: { src: "/media/very-enhanced-bedroom_262c2040.webp", width: 1086, height: 1448 },
  veryBathroom: { src: "/media/very-enhanced-bathroom_c918e00d.webp", width: 1086, height: 1448 },
  everLiving: { src: "/media/ever-enhanced-living_6eb96fe0.webp", width: 1619, height: 971 },
  everEntry: { src: "/media/ever-enhanced-entry_054ed219.webp", width: 971, height: 1619 },
  everBedroom: { src: "/media/ever-enhanced-bedroom_5f368637.webp", width: 1619, height: 971 },
  everShower: { src: "/media/ever-enhanced-shower_967e9d92.webp", width: 971, height: 1619 },
  ostrovKitchen: { src: "/media/ostrov-render-kitchen_86ef2785.webp", width: 977, height: 973 },
} satisfies Record<string, SiteImage>;

const bySrc = new Map<string, SiteImage>(Object.values(siteImages).map(image => [image.src, image]));

/** Intrinsic size for an image path, so the browser can reserve its box. */
export function imageSize(src: string): { width?: number; height?: number } {
  const image = bySrc.get(src);
  return image ? { width: image.width, height: image.height } : {};
}

/** JPEG link-preview twin of a page image. */
export function ogImageFor(src: string): string {
  return src.replace(/^\/media\/(.+?)(?:-\d+)?\.webp$/, "/media/og/$1.jpg");
}
