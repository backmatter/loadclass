import { db } from "@loadclass/db";
import { DEFAULT_MAX_ARCHIVE_BYTES } from "@loadclass/registry-contract";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import { optionalAuth, requireAuth } from "../middleware/auth.ts";
import {
  ListTemplatesQuery,
  ListTemplatesResponse,
  TemplateManifest,
  TemplateDetail,
  PublishResponse,
  DistTagBody,
  DistTagResponse,
  YankBody,
  DeprecateBody,
  ErrorResponse,
} from "../schemas.ts";
import { authSecurity, unauthorizedResponse } from "../openapi.ts";
import { listManageableTemplates } from "../registry/ownership.ts";
import { templateManagementScopeForRequest } from "../registry/organization-authorization.ts";
import { publishTemplateVersion } from "../registry/publishing.ts";
import {
  getTemplateDetail,
  listManageableTemplatesPage,
  listTemplatesPage,
} from "../registry/template-read-model.ts";
import { registryErrorResponse, registryRespond } from "./respond.ts";
import { decodeRouteParam } from "./params.ts";
import {
  deleteDistTag,
  deprecateTemplate,
  readTemplateThumbnail,
  restoreDeprecatedTemplate,
  setDistTag,
  starTemplate,
  unstarTemplate,
  yankTemplateVersion,
} from "../registry/template-actions.ts";
import { publishIpRateLimit, publishUserRateLimit } from "../middleware/rate-limit.ts";

const templateManifestSchema = resolver(TemplateManifest) as unknown as { $ref: string };
const PUBLISH_BODY_OVERHEAD_BYTES = 1024 * 1024;

function configuredPositiveInt(name: string): number | null {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function maxPublishBodyBytes(): number {
  return (
    configuredPositiveInt("MAX_PUBLISH_BODY_BYTES") ??
    (configuredPositiveInt("MAX_ARCHIVE_BYTES") ?? DEFAULT_MAX_ARCHIVE_BYTES) +
      PUBLISH_BODY_OVERHEAD_BYTES
  );
}

const publishBodyLimit = bodyLimit({
  maxSize: maxPublishBodyBytes(),
  onError: (c) =>
    c.json(
      {
        error: "Publish request is too large.",
        code: "payload_too_large",
        detail: `Upload multipart body must be at most ${maxPublishBodyBytes()} bytes.`,
      },
      413,
    ),
});

const publishRequestBody = {
  required: true,
  description:
    "Multipart form data. `manifest` is a JSON part matching `TemplateManifest`; `archive` is the `.tar.gz` or `.tgz` template archive.",
  content: {
    "multipart/form-data": {
      schema: {
        type: "object" as const,
        properties: {
          manifest: {
            allOf: [templateManifestSchema],
            description: "Template manifest metadata as JSON.",
          },
          archive: {
            type: "string" as const,
            format: "binary" as const,
            description:
              "Gzip-compressed tar archive containing `loadclass.json` and template files.",
          },
        },
        required: ["manifest", "archive"],
      },
      encoding: {
        manifest: { contentType: "application/json" },
        archive: { contentType: "application/gzip" },
      },
    },
  },
};

export const templatesRouter = new Hono()
  .get(
    "/",
    optionalAuth,
    describeRoute({
      tags: ["Templates"],
      summary: "Browse and search templates",
      responses: {
        200: {
          description: "Template list",
          content: { "application/json": { schema: resolver(ListTemplatesResponse) } },
        },
      },
    }),
    zValidator("query", ListTemplatesQuery),
    async (c) => {
      const { q, category, sort, page, per_page } = c.req.valid("query");
      return registryRespond(c, () =>
        listTemplatesPage({ q, category, sort, page, perPage: per_page }),
      );
    },
  )

  .get(
    "/mine",
    requireAuth,
    describeRoute({
      tags: ["Publishing"],
      summary: "List templates owned by the authenticated user",
      security: authSecurity,
      responses: {
        200: {
          description: "Template list",
          content: { "application/json": { schema: resolver(ListTemplatesResponse) } },
        },
        401: unauthorizedResponse,
      },
    }),
    async (c) => {
      const user = c.get("user");
      const scope = await templateManagementScopeForRequest({
        store: db,
        userId: user.id,
        headers: c.req.raw.headers,
      });
      return registryRespond(c, async () =>
        listManageableTemplatesPage(await listManageableTemplates(user.id, scope)),
      );
    },
  )

  .get(
    "/:name/thumbnail",
    describeRoute({
      tags: ["Templates"],
      summary: "Get template thumbnail",
      responses: {
        200: {
          description: "Template thumbnail image",
          content: {
            "image/*": { schema: { type: "string", format: "binary" } },
          },
        },
        404: {
          description: "Not found",
          content: { "application/json": { schema: resolver(ErrorResponse) } },
        },
      },
    }),
    zValidator("param", z.object({ name: z.string() })),
    async (c) => {
      const name = decodeRouteParam(c.req.valid("param").name);
      try {
        const thumbnail = await readTemplateThumbnail(db, name);
        return new Response(new Uint8Array(thumbnail.body), {
          headers: {
            "content-type": thumbnail.contentType,
            "cache-control": "public, max-age=3600",
          },
        });
      } catch (error) {
        return registryErrorResponse(c, error);
      }
    },
  )

  .get(
    "/:name",
    optionalAuth,
    describeRoute({
      tags: ["Templates"],
      summary: "Get template details",
      responses: {
        200: {
          description: "Template detail",
          content: { "application/json": { schema: resolver(TemplateDetail) } },
        },
        404: {
          description: "Not found",
          content: { "application/json": { schema: resolver(ErrorResponse) } },
        },
      },
    }),
    zValidator("param", z.object({ name: z.string() })),
    async (c) => {
      const name = decodeRouteParam(c.req.valid("param").name);
      const user = c.get("user");
      const scope = user
        ? await templateManagementScopeForRequest({
            store: db,
            userId: user.id,
            headers: c.req.raw.headers,
          })
        : undefined;
      return registryRespond(c, () => getTemplateDetail(name, user?.id, scope));
    },
  )

  .post(
    "/",
    publishBodyLimit,
    requireAuth,
    publishUserRateLimit,
    publishIpRateLimit,
    describeRoute({
      tags: ["Publishing"],
      summary: "Publish a new template version",
      description: "Publishes an immutable template version and moves `latest` when applicable.",
      security: authSecurity,
      requestBody: publishRequestBody,
      responses: {
        201: {
          description: "Published",
          content: { "application/json": { schema: resolver(PublishResponse) } },
        },
        400: {
          description: "Bad request",
          content: { "application/json": { schema: resolver(ErrorResponse) } },
        },
        403: {
          description: "Forbidden",
          content: { "application/json": { schema: resolver(ErrorResponse) } },
        },
        401: unauthorizedResponse,
      },
    }),
    async (c) => {
      const user = c.get("user");
      const formData = await c.req.formData();
      const scope = await templateManagementScopeForRequest({
        store: db,
        userId: user.id,
        headers: c.req.raw.headers,
      });
      return registryRespond(
        c,
        () =>
          publishTemplateVersion({
            userId: user.id,
            scope,
            manifestRaw: formData.get("manifest"),
            archive: formData.get("archive"),
          }),
        201,
      );
    },
  )

  .delete(
    "/:name/dist-tags/:tag",
    requireAuth,
    describeRoute({
      tags: ["Publishing"],
      summary: "Delete a dist-tag",
      security: authSecurity,
      responses: {
        204: { description: "Deleted" },
        401: unauthorizedResponse,
        403: {
          description: "Forbidden",
          content: { "application/json": { schema: resolver(ErrorResponse) } },
        },
        404: {
          description: "Not found",
          content: { "application/json": { schema: resolver(ErrorResponse) } },
        },
      },
    }),
    zValidator("param", z.object({ name: z.string(), tag: z.string() })),
    async (c) => {
      const { name, tag } = c.req.valid("param");
      const user = c.get("user");
      const scope = await templateManagementScopeForRequest({
        store: db,
        userId: user.id,
        headers: c.req.raw.headers,
      });
      return registryRespond(c, () =>
        deleteDistTag(db, {
          userId: user.id,
          templateName: decodeRouteParam(name),
          tag: decodeRouteParam(tag),
          scope,
        }),
      );
    },
  )

  .put(
    "/:name/dist-tags/:tag",
    requireAuth,
    describeRoute({
      tags: ["Publishing"],
      summary: "Set a dist-tag",
      security: authSecurity,
      responses: {
        200: {
          description: "Dist-tag",
          content: { "application/json": { schema: resolver(DistTagResponse) } },
        },
        401: unauthorizedResponse,
        400: {
          description: "Bad request",
          content: { "application/json": { schema: resolver(ErrorResponse) } },
        },
        403: {
          description: "Forbidden",
          content: { "application/json": { schema: resolver(ErrorResponse) } },
        },
        404: {
          description: "Not found",
          content: { "application/json": { schema: resolver(ErrorResponse) } },
        },
      },
    }),
    zValidator("param", z.object({ name: z.string(), tag: z.string() })),
    zValidator("json", DistTagBody),
    async (c) => {
      const { name, tag } = c.req.valid("param");
      const { version } = c.req.valid("json");
      const user = c.get("user");
      const scope = await templateManagementScopeForRequest({
        store: db,
        userId: user.id,
        headers: c.req.raw.headers,
      });
      return registryRespond(c, () =>
        setDistTag(db, {
          userId: user.id,
          templateName: decodeRouteParam(name),
          tag: decodeRouteParam(tag),
          version,
          scope,
        }),
      );
    },
  )

  .delete(
    "/:name/versions/:version/yank",
    requireAuth,
    describeRoute({
      tags: ["Publishing"],
      summary: "Yank a version",
      security: authSecurity,
      responses: {
        204: { description: "Yanked" },
        401: unauthorizedResponse,
        403: {
          description: "Forbidden",
          content: { "application/json": { schema: resolver(ErrorResponse) } },
        },
        404: {
          description: "Not found",
          content: { "application/json": { schema: resolver(ErrorResponse) } },
        },
      },
    }),
    zValidator("param", z.object({ name: z.string(), version: z.string() })),
    zValidator("json", YankBody),
    async (c) => {
      const { name, version } = c.req.valid("param");
      const { reason } = c.req.valid("json");
      const user = c.get("user");
      const scope = await templateManagementScopeForRequest({
        store: db,
        userId: user.id,
        headers: c.req.raw.headers,
      });
      return registryRespond(c, () =>
        yankTemplateVersion(db, {
          userId: user.id,
          templateName: decodeRouteParam(name),
          version,
          reason,
          scope,
        }),
      );
    },
  )

  .post(
    "/:name/star",
    requireAuth,
    describeRoute({
      tags: ["Templates"],
      summary: "Star a template",
      security: authSecurity,
      responses: {
        204: { description: "Starred" },
        401: unauthorizedResponse,
        404: {
          description: "Not found",
          content: { "application/json": { schema: resolver(ErrorResponse) } },
        },
      },
    }),
    zValidator("param", z.object({ name: z.string() })),
    async (c) => {
      const name = decodeRouteParam(c.req.valid("param").name);
      const user = c.get("user");
      return registryRespond(c, () => starTemplate(db, user.id, name));
    },
  )

  .delete(
    "/:name/star",
    requireAuth,
    describeRoute({
      tags: ["Templates"],
      summary: "Unstar a template",
      security: authSecurity,
      responses: {
        204: { description: "Unstarred" },
        401: unauthorizedResponse,
        404: {
          description: "Not found",
          content: { "application/json": { schema: resolver(ErrorResponse) } },
        },
      },
    }),
    zValidator("param", z.object({ name: z.string() })),
    async (c) => {
      const name = decodeRouteParam(c.req.valid("param").name);
      const user = c.get("user");
      return registryRespond(c, () => unstarTemplate(db, user.id, name));
    },
  )

  .post(
    "/:name/deprecate",
    requireAuth,
    describeRoute({
      tags: ["Publishing"],
      summary: "Deprecate a template",
      security: authSecurity,
      responses: {
        204: { description: "Deprecated" },
        401: unauthorizedResponse,
        403: {
          description: "Forbidden",
          content: { "application/json": { schema: resolver(ErrorResponse) } },
        },
        404: {
          description: "Not found",
          content: { "application/json": { schema: resolver(ErrorResponse) } },
        },
      },
    }),
    zValidator("param", z.object({ name: z.string() })),
    zValidator("json", DeprecateBody),
    async (c) => {
      const name = decodeRouteParam(c.req.valid("param").name);
      const { message } = c.req.valid("json");
      const user = c.get("user");
      const scope = await templateManagementScopeForRequest({
        store: db,
        userId: user.id,
        headers: c.req.raw.headers,
      });
      return registryRespond(c, () =>
        deprecateTemplate(db, {
          userId: user.id,
          templateName: name,
          message,
          scope,
        }),
      );
    },
  )

  .delete(
    "/:name/deprecate",
    requireAuth,
    describeRoute({
      tags: ["Publishing"],
      summary: "Undeprecate a template",
      security: authSecurity,
      responses: {
        204: { description: "Undeprecated" },
        401: unauthorizedResponse,
        403: {
          description: "Forbidden",
          content: { "application/json": { schema: resolver(ErrorResponse) } },
        },
        404: {
          description: "Not found",
          content: { "application/json": { schema: resolver(ErrorResponse) } },
        },
      },
    }),
    zValidator("param", z.object({ name: z.string() })),
    async (c) => {
      const name = decodeRouteParam(c.req.valid("param").name);
      const user = c.get("user");
      const scope = await templateManagementScopeForRequest({
        store: db,
        userId: user.id,
        headers: c.req.raw.headers,
      });
      return registryRespond(c, () =>
        restoreDeprecatedTemplate(db, {
          userId: user.id,
          templateName: name,
          scope,
        }),
      );
    },
  );
