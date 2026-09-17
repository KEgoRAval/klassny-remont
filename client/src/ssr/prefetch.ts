export type HeadMeta = {
  title: string;
  description: string;
  ogType?: "website" | "article";
  ogImage?: string;
  ogImageAlt?: string;
  canonicalPath?: string;
  noindex?: boolean;
  notFound?: boolean;
};

export const SITE_NAME = "Классный Ремонт";
export const HOME_TITLE = "Ремонт квартир под ключ в Москве — Классный Ремонт";
export const HOME_DESCRIPTION = "Ремонт квартир бизнес- и премиум-класса в Москве от 40 000 ₽/м² за работы. Смета и сроки фиксируются в договоре. Предварительный расчёт за 24 часа.";

export function prefetchForPath(url: string): HeadMeta {
  let pathOnly = url.split("?")[0];
  try {
    pathOnly = decodeURI(pathOnly);
  } catch {
    // Keep the original path if it is malformed, mirroring router behaviour.
  }
  const path = pathOnly.replace(/\/+$/, "") || "/";

  if (path === "/") {
    return {
      title: HOME_TITLE,
      description: HOME_DESCRIPTION,
      ogType: "website",
      ogImage: "/manus-storage/hero-living-room_277d141a.jpg",
      ogImageAlt: "Интерьер гостиной после ремонта от Классного Ремонта",
      canonicalPath: "/",
    };
  }

  return {
    title: `Страница не найдена — ${SITE_NAME}`,
    description: HOME_DESCRIPTION,
    noindex: true,
    notFound: true,
  };
}
