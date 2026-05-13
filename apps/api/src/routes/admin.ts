import { db } from "@loadclass/db";
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { requireAdmin } from "../middleware/auth.ts";
import { listAdminOrganizations, listAdminTemplates } from "../registry/template-read-model.ts";
import { setTemplateVerification } from "../registry/template-actions.ts";
import { setOrganizationVerification } from "../registry/organization-actions.ts";
import { registryRespond } from "./respond.ts";
import { decodeRouteParam } from "./params.ts";
import {
  AdminOrganizationsResponse,
  AdminTemplatesResponse,
  OrganizationVerificationResponse,
  TemplateVerificationResponse,
} from "../schemas.ts";
import {
  authSecurity,
  forbiddenResponse,
  notFoundResponse,
  unauthorizedResponse,
} from "../openapi.ts";

export const adminRouter = new Hono()
  // ── Admin list endpoints ─────────────────────────────────────────────────────

  .get(
    "/templates",
    requireAdmin,
    describeRoute({
      tags: ["Admin"],
      summary: "List all templates for moderation",
      security: authSecurity,
      responses: {
        200: {
          description: "Admin template list",
          content: { "application/json": { schema: resolver(AdminTemplatesResponse) } },
        },
        401: unauthorizedResponse,
        403: forbiddenResponse,
      },
    }),
    async (c) => registryRespond(c, () => listAdminTemplates()),
  )

  .get(
    "/orgs",
    requireAdmin,
    describeRoute({
      tags: ["Admin"],
      summary: "List all organizations for moderation",
      security: authSecurity,
      responses: {
        200: {
          description: "Admin organization list",
          content: { "application/json": { schema: resolver(AdminOrganizationsResponse) } },
        },
        401: unauthorizedResponse,
        403: forbiddenResponse,
      },
    }),
    async (c) => registryRespond(c, () => listAdminOrganizations()),
  )

  // ── Org verification ────────────────────────────────────────────────────────

  .post(
    "/orgs/:slug/verify",
    requireAdmin,
    describeRoute({
      tags: ["Admin"],
      summary: "Verify an organization",
      security: authSecurity,
      responses: {
        200: {
          description: "Updated organization",
          content: { "application/json": { schema: resolver(OrganizationVerificationResponse) } },
        },
        401: unauthorizedResponse,
        403: forbiddenResponse,
        404: notFoundResponse,
      },
    }),
    async (c) => {
      const slug = c.req.param("slug");
      return registryRespond(c, () => setOrganizationVerification(db, slug, true));
    },
  )

  .delete(
    "/orgs/:slug/verify",
    requireAdmin,
    describeRoute({
      tags: ["Admin"],
      summary: "Remove organization verification",
      security: authSecurity,
      responses: {
        200: {
          description: "Updated organization",
          content: { "application/json": { schema: resolver(OrganizationVerificationResponse) } },
        },
        401: unauthorizedResponse,
        403: forbiddenResponse,
        404: notFoundResponse,
      },
    }),
    async (c) => {
      const slug = c.req.param("slug");
      return registryRespond(c, () => setOrganizationVerification(db, slug, false));
    },
  )

  // ── Individual template verification ────────────────────────────────────────

  .post(
    "/templates/:name/verify",
    requireAdmin,
    describeRoute({
      tags: ["Admin"],
      summary: "Verify a template",
      security: authSecurity,
      responses: {
        200: {
          description: "Updated template",
          content: { "application/json": { schema: resolver(TemplateVerificationResponse) } },
        },
        401: unauthorizedResponse,
        403: forbiddenResponse,
        404: notFoundResponse,
      },
    }),
    async (c) => {
      const name = decodeRouteParam(c.req.param("name"));
      return registryRespond(c, () => setTemplateVerification(db, name, true));
    },
  )

  .delete(
    "/templates/:name/verify",
    requireAdmin,
    describeRoute({
      tags: ["Admin"],
      summary: "Remove template verification",
      security: authSecurity,
      responses: {
        200: {
          description: "Updated template",
          content: { "application/json": { schema: resolver(TemplateVerificationResponse) } },
        },
        401: unauthorizedResponse,
        403: forbiddenResponse,
        404: notFoundResponse,
      },
    }),
    async (c) => {
      const name = decodeRouteParam(c.req.param("name"));
      return registryRespond(c, () => setTemplateVerification(db, name, false));
    },
  );

// Role management is handled by Better Auth's admin plugin:
// POST /api/auth/admin/set-role  { userId, role: "admin" | "user" }
// POST /api/auth/admin/ban-user  { userId, banReason?, banExpiresIn? }
// POST /api/auth/admin/unban-user { userId }
