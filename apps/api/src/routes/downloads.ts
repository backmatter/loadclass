import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import {
  DownloadUrlResponse,
  DownloadStatsQuery,
  DownloadStatsResponse,
  ErrorResponse,
} from "../schemas.ts";
import {
  getTemplateDownloadStats,
  prepareTemplateDownload,
} from "../registry/download-accounting.ts";
import { registryErrorResponse } from "./respond.ts";
import { decodeRouteParam } from "./params.ts";
import { clientIp, downloadRateLimit } from "../middleware/rate-limit.ts";

export const downloadsRouter = new Hono()
  .get(
    "/:name/versions/:version/download",
    downloadRateLimit,
    describeRoute({
      tags: ["Downloads"],
      summary: "Get a signed download URL for a specific version",
      responses: {
        200: {
          description: "Signed URL",
          content: { "application/json": { schema: resolver(DownloadUrlResponse) } },
        },
        404: {
          description: "Not found",
          content: { "application/json": { schema: resolver(ErrorResponse) } },
        },
        429: {
          description: "Rate limited",
          content: { "application/json": { schema: resolver(ErrorResponse) } },
        },
      },
    }),
    zValidator("param", z.object({ name: z.string(), version: z.string() })),
    async (c) => {
      const { name, version } = c.req.valid("param");
      const ip = clientIp(c);

      try {
        return c.json(
          await prepareTemplateDownload({
            templateName: decodeRouteParam(name),
            version,
            ipAddress: ip,
            userAgent: c.req.header("user-agent") ?? null,
            source: c.req.query("source"),
          }),
        );
      } catch (error) {
        return registryErrorResponse(c, error);
      }
    },
  )

  .get(
    "/:name/downloads",
    describeRoute({
      tags: ["Downloads"],
      summary: "Get download stats for a template",
      responses: {
        200: {
          description: "Download stats",
          content: { "application/json": { schema: resolver(DownloadStatsResponse) } },
        },
        404: {
          description: "Not found",
          content: { "application/json": { schema: resolver(ErrorResponse) } },
        },
      },
    }),
    zValidator("param", z.object({ name: z.string() })),
    zValidator("query", DownloadStatsQuery),
    async (c) => {
      const name = decodeRouteParam(c.req.valid("param").name);
      const { period } = c.req.valid("query");
      try {
        return c.json(await getTemplateDownloadStats(name, period));
      } catch (error) {
        return registryErrorResponse(c, error);
      }
    },
  );
