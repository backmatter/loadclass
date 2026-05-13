import { runtimePublicConfigFromEnv } from "./runtime-config";

const SITE_NAME = "Loadclass";
const DEFAULT_TITLE = "Loadclass - LaTeX templates for papers, theses, and presentations";
const DEFAULT_DESCRIPTION =
  "Browse, publish, and download LaTeX templates for academic papers, theses, presentations, CVs, posters, reports, and more.";
const DEFAULT_IMAGE_PATH = "/og-image.png";

type JsonLdValue =
  | string
  | number
  | boolean
  | null
  | JsonLdValue[]
  | { [key: string]: JsonLdValue | undefined };

interface PageMetaOptions {
  title?: string;
  description?: string;
  path?: string;
  image?: string | null;
  type?: "website" | "article" | "profile";
  robots?: string;
  jsonLd?: { [key: string]: JsonLdValue | undefined };
}

function configuredSiteUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin.replace(/\/+$/, "");
  }

  return runtimePublicConfigFromEnv().siteUrl;
}

export const defaultSiteDescription = DEFAULT_DESCRIPTION;

export function siteUrl(): string {
  return configuredSiteUrl();
}

export function absoluteUrl(path = "/"): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export function templateWebPath(name: string): string {
  return `/templates/${encodeURIComponent(name)}`;
}

export function pageMeta({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  path = "/",
  image,
  type = "website",
  robots = "index,follow",
  jsonLd,
}: PageMetaOptions = {}) {
  const canonical = absoluteUrl(path);
  const imageUrl = absoluteUrl(image ?? DEFAULT_IMAGE_PATH);

  return {
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: robots },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:type", content: type },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: canonical },
      { property: "og:image", content: imageUrl },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: `${SITE_NAME} logo` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: imageUrl },
      ...(jsonLd ? [{ "script:ld+json": jsonLd }] : []),
    ],
    links: [{ rel: "canonical", href: canonical }],
  };
}

export function privatePageMeta(title: string, path: string) {
  return pageMeta({
    title,
    path,
    robots: "noindex,follow",
  });
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: siteUrl(),
    potentialAction: {
      "@type": "SearchAction",
      target: `${absoluteUrl("/templates")}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: siteUrl(),
    logo: absoluteUrl("/brand/logo-mark-dark.png"),
  };
}
