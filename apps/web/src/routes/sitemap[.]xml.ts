import { listTemplatesPath, type ListTemplatesResponse } from "@loadclass/registry-contract";
import { createFileRoute } from "@tanstack/react-router";
import { absoluteUrl, templateWebPath } from "@/lib/site-metadata";
import { internalApiUrl } from "@/lib/runtime-config";

const MAX_TEMPLATE_SITEMAP_ENTRIES = 500;

interface SitemapEntry {
  path: string;
  lastmod?: string | null;
  changefreq?: "daily" | "weekly" | "monthly";
  priority?: string;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sitemapXml(entries: SitemapEntry[]): string {
  const urls = entries
    .map((entry) => {
      const loc = escapeXml(absoluteUrl(entry.path));
      const lastmod = entry.lastmod
        ? `<lastmod>${escapeXml(new Date(entry.lastmod).toISOString())}</lastmod>`
        : "";
      const changefreq = entry.changefreq ? `<changefreq>${entry.changefreq}</changefreq>` : "";
      const priority = entry.priority ? `<priority>${entry.priority}</priority>` : "";
      return `<url><loc>${loc}</loc>${lastmod}${changefreq}${priority}</url>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

async function fetchTemplateEntries(): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;

  while (entries.length < Math.min(total, MAX_TEMPLATE_SITEMAP_ENTRIES)) {
    const path = listTemplatesPath({ sort: "downloads", page, perPage: 100 });
    const response = await fetch(`${internalApiUrl()}${path}`);
    if (!response.ok) throw new Error(`Failed to load templates for sitemap: ${response.status}`);

    const data = (await response.json()) as ListTemplatesResponse;
    total = data.total;
    entries.push(
      ...data.templates.map((template) => ({
        path: templateWebPath(template.name),
        lastmod: template.updatedAt,
        changefreq: "weekly" as const,
        priority: "0.8",
      })),
    );

    if (data.templates.length === 0 || entries.length >= total) break;
    page += 1;
  }

  return entries.slice(0, MAX_TEMPLATE_SITEMAP_ENTRIES);
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const staticEntries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/templates", changefreq: "daily", priority: "0.9" },
          { path: "/docs", changefreq: "monthly", priority: "0.5" },
        ];

        const templateEntries = await fetchTemplateEntries().catch(() => []);
        return new Response(sitemapXml([...staticEntries, ...templateEntries]), {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
