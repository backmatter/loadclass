import { createFileRoute } from "@tanstack/react-router";
import { absoluteUrl } from "@/lib/site-metadata";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () =>
        new Response(
          [
            "User-agent: *",
            "Allow: /",
            "Disallow: /account",
            "Disallow: /admin",
            "Disallow: /publish",
            "Disallow: /login",
            "Disallow: /register",
            "Disallow: /forgot-password",
            "Disallow: /reset-password",
            "Disallow: /lab",
            "",
            `Sitemap: ${absoluteUrl("/sitemap.xml")}`,
            "",
          ].join("\n"),
          {
            headers: {
              "content-type": "text/plain; charset=utf-8",
              "cache-control": "public, max-age=3600",
            },
          },
        ),
    },
  },
});
