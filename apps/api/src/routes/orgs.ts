import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { getOrganizationProfile } from "../registry/template-read-model.ts";
import { registryErrorResponse } from "./respond.ts";
import { OrganizationProfile } from "../schemas.ts";
import { notFoundResponse } from "../openapi.ts";

export const orgsRouter = new Hono().get(
  "/:slug",
  describeRoute({
    tags: ["Profiles"],
    summary: "Get an organization profile and their published templates",
    responses: {
      200: {
        description: "Organization profile",
        content: { "application/json": { schema: resolver(OrganizationProfile) } },
      },
      404: notFoundResponse,
    },
  }),
  async (c) => {
    const slug = c.req.param("slug");
    try {
      return c.json(await getOrganizationProfile(slug));
    } catch (error) {
      return registryErrorResponse(c, error);
    }
  },
);
