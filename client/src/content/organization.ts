// Shared schema.org identity of the company. Paths starting with "/" are made absolute by the SSR head builder.
export const ORGANIZATION_ID = "/#organization";
export const WEBSITE_ID = "/#website";

export const organizationLogo = {
  "@type": "ImageObject",
  url: "/krem-logo-512.png",
  width: 512,
  height: 512,
};

// Short reference used as author/publisher on blog pages; the full node lives on the home page.
export const organizationRef = {
  "@type": "Organization",
  "@id": ORGANIZATION_ID,
  name: "Классный Ремонт",
  url: "/",
  logo: organizationLogo,
};

export const websiteJsonLd = {
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  url: "/",
  name: "Классный Ремонт",
  inLanguage: "ru-RU",
  publisher: { "@id": ORGANIZATION_ID },
};
