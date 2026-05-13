import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { getUserProfile } from "../registry/template-read-model.ts";
import { registryErrorResponse } from "./respond.ts";
import { UserProfile } from "../schemas.ts";
import { notFoundResponse } from "../openapi.ts";

export const usersRouter = new Hono().get(
  "/:id",
  describeRoute({
    tags: ["Profiles"],
    summary: "Get a user profile and their published templates",
    responses: {
      200: {
        description: "User profile",
        content: { "application/json": { schema: resolver(UserProfile) } },
      },
      404: notFoundResponse,
    },
  }),
  async (c) => {
    const id = c.req.param("id");
    try {
      return c.json(await getUserProfile(id));
    } catch (error) {
      return registryErrorResponse(c, error);
    }
  },
);
