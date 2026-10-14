import { blogArticleJsonLd, blogIndexJsonLd, getBlogPostFromPath } from "@/content/blog";
import { ogImageFor, siteImages } from "@/content/media";
import { ORGANIZATION_ID, organizationLogo, websiteJsonLd } from "@/content/organization";

export type HeadMeta = {
  title: string;
  description: string;
  ogType?: "website" | "article";
  ogImage?: string;
  ogImageAlt?: string;
  canonicalPath?: string;
  publishedAt?: string;
  modifiedAt?: string;
  structuredData?: unknown;
  noindex?: boolean;
  notFound?: boolean;
};

export const SITE_NAME = "Классный Ремонт";
export const HOME_TITLE = "Ремонт квартир под ключ в Москве — Классный Ремонт";
export const HOME_DESCRIPTION = "Ремонт квартир бизнес- и премиум-класса в Москве от 40 000 ₽/м² за работы. Смета и сроки фиксируются в договоре. Предварительный расчёт за 2 часа.";

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
      ogImage: ogImageFor(siteImages.hero.src),
      ogImageAlt: "Интерьер гостиной после ремонта от Классного Ремонта",
      canonicalPath: "/",
      structuredData: {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": ["HomeAndConstructionBusiness", "LocalBusiness"],
            "@id": ORGANIZATION_ID,
            name: "Классный Ремонт",
            legalName: "ИП Бережной Егор Юрьевич",
            description: "Ремонт квартир бизнес- и премиум-класса под ключ в Москве: от замера и сметы до приёмки готового объекта.",
            url: "/",
            logo: organizationLogo,
            image: ogImageFor(siteImages.hero.src),
            areaServed: [{ "@type": "City", name: "Москва" }, { "@type": "AdministrativeArea", name: "Московская область" }],
            priceRange: "от 40 000 ₽/м² за работы",
            telephone: "+7 977 948-06-72",
            address: { "@type": "PostalAddress", addressLocality: "Москва", addressCountry: "RU" },
            hasOfferCatalog: { "@type": "OfferCatalog", name: "Услуги Классного Ремонта", itemListElement: [
              { "@type": "Offer", itemOffered: { "@type": "Service", name: "Ремонт квартиры под ключ" } },
              { "@type": "Offer", itemOffered: { "@type": "Service", name: "Дизайн-проект и ремонт" } },
              { "@type": "Offer", itemOffered: { "@type": "Service", name: "Инженерные системы" } },
              { "@type": "Offer", itemOffered: { "@type": "Service", name: "Черновая отделка" } },
            ] },
          },
          websiteJsonLd,
          {
            "@type": "FAQPage",
            "@id": "/#faq",
            mainEntity: [
              { "@type": "Question", name: "Сколько стоит ремонт квартиры в Москве?", acceptedAnswer: { "@type": "Answer", text: "Стоимость работ начинается от 40 000 ₽ за м². Точный бюджет зависит от площади, состояния квартиры, инженерных решений и состава отделки. Материалы, мебель и декор рассчитываются отдельными строками." } },
              { "@type": "Question", name: "Что входит в ремонт под ключ?", acceptedAnswer: { "@type": "Answer", text: "В ремонт под ключ входят организация работ, черновая и чистовая отделка, реализация инженерных систем по проекту, контроль критичных этапов, фотоотчёты и подготовка объекта к приёмке." } },
              { "@type": "Question", name: "Как контролируется смета и изменения по ходу работ?", acceptedAnswer: { "@type": "Answer", text: "До старта в договоре фиксируются согласованные объём работ, стоимость и порядок изменений. Перед новым решением клиент получает информацию о его влиянии на бюджет и график." } },
              { "@type": "Question", name: "Можно ли увидеть объект до договора?", acceptedAnswer: { "@type": "Answer", text: "По предварительной договорённости Классный Ремонт приглашает на объект в работе, чтобы показать организацию площадки и подход к контролю качества." } },
              { "@type": "Question", name: "Сколько длится ремонт квартиры?", acceptedAnswer: { "@type": "Answer", text: "Ориентировочный срок качественного ремонта начинается от 4 месяцев. Точный календарный план готовится после замера и согласования проекта." } },
            ],
          },
        ],
      },
    };
  }

  if (path === "/blog") {
    return {
      title: "Блог о ремонте квартир в Москве — Классный Ремонт",
      description: "Практические статьи о стоимости и сроках ремонта, приёмке квартиры в новостройке и подготовке к ремонту в жилых комплексах Москвы.",
      ogType: "website",
      ogImage: ogImageFor(siteImages.veryLiving.src),
      ogImageAlt: "Современный интерьер квартиры в Москве",
      canonicalPath: "/blog",
      structuredData: blogIndexJsonLd,
    };
  }

  if (path === "/max") {
    // Opened from the MAX messenger bot; not a search landing page.
    return {
      title: "Расчёт ремонта — Классный Ремонт",
      description: "Пришлите дизайн-проект — смета за 2 часа. Или ответьте на 3 вопроса и получите предварительный расчёт стоимости ремонта квартиры в Москве.",
      ogType: "website",
      ogImage: ogImageFor(siteImages.hero.src),
      canonicalPath: "/max",
      noindex: true,
    };
  }

  if (path === "/privacy-policy") {
    return {
      title: "Политика обработки персональных данных — Классный Ремонт",
      description: "Политика обработки персональных данных ИП Бережного Егора Юрьевича для сайта Классный Ремонт.",
      canonicalPath: "/privacy-policy",
      noindex: true,
    };
  }

  if (path === "/personal-data-consent") {
    return {
      title: "Согласие на обработку персональных данных — Классный Ремонт",
      description: "Текст согласия на обработку персональных данных для форм сайта Классный Ремонт.",
      canonicalPath: "/personal-data-consent",
      noindex: true,
    };
  }

  const post = getBlogPostFromPath(path);
  if (post) {
    return {
      title: `${post.title} — Классный Ремонт`,
      description: post.description,
      ogType: "article",
      ogImage: ogImageFor(post.image),
      ogImageAlt: post.imageAlt,
      canonicalPath: post.path,
      publishedAt: post.publishedAt,
      modifiedAt: post.modifiedAt,
      structuredData: blogArticleJsonLd(post),
    };
  }

  return {
    title: `Страница не найдена — ${SITE_NAME}`,
    description: HOME_DESCRIPTION,
    noindex: true,
    notFound: true,
  };
}
