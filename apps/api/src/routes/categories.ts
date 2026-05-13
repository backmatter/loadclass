import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { listCategorySummaries } from "../registry/template-read-model.ts";
import { Category } from "../schemas.ts";

export const categoriesRouter = new Hono().get(
  "/",
  describeRoute({
    tags: ["Templates"],
    summary: "List template categories",
    responses: {
      200: {
        description: "Category list",
        content: { "application/json": { schema: resolver(Category.array()) } },
      },
    },
  }),
  async (c) => {
    return c.json(await listCategorySummaries());
  },
);
