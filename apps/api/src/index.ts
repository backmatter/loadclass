import "./types.ts";
process.title = "loadclass-api";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { openAPISpecs } from "hono-openapi";
import { apiReference } from "@scalar/hono-api-reference";
import { db } from "@loadclass/db";
import { sql } from "drizzle-orm";
import { auth } from "./auth.ts";
import { templatesRouter } from "./routes/templates.ts";
import { downloadsRouter } from "./routes/downloads.ts";
import { categoriesRouter } from "./routes/categories.ts";
import { adminRouter } from "./routes/admin.ts";
import { usersRouter } from "./routes/users.ts";
import { orgsRouter } from "./routes/orgs.ts";
import { resolver } from "hono-openapi/zod";
import { RegistryInfo } from "./schemas.ts";
import { describeRoute } from "hono-openapi";
import { getRegistrySettings, isRegistrationAllowed } from "./registry/config.ts";
import { checkStorageBucket, ensureStorageBucket } from "./storage.ts";
import { apiRateLimit, authRateLimit, mutationRateLimit } from "./middleware/rate-limit.ts";
import { cookieMutationOriginGuard, corsOrigins } from "./middleware/origin-guard.ts";
import { assertApiRuntimeConfig } from "./runtime-config.ts";

const app = new Hono();

const allowedCorsOrigins = corsOrigins();
assertApiRuntimeConfig({ corsOrigins: allowedCorsOrigins });

app.use(
  cors({
    origin: allowedCorsOrigins,
    credentials: true,
  }),
);

app.use(logger());

app.use("/api/auth/*", authRateLimit);

app.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (session) {
    c.set("user", session.user);
    c.set("session", session.session);
  }
  await next();
});

app.use("/v1/*", apiRateLimit);
app.use("/v1/*", cookieMutationOriginGuard(allowedCorsOrigins));
app.use("/v1/*", mutationRateLimit);

// Better Auth handles all /api/auth/* routes
app.on(["GET", "POST"], "/api/auth/*", async (c) => {
  if (c.req.method === "POST" && c.req.path.endsWith("/sign-up/email")) {
    if (!(await isRegistrationAllowed())) {
      return c.json({ error: "Registration is disabled on this registry" }, 403);
    }
  }

  return auth.handler(c.req.raw);
});

// Registry API
app.route("/v1/templates", templatesRouter);
app.route("/v1/templates", downloadsRouter);
app.route("/v1/categories", categoriesRouter);
app.route("/v1/admin", adminRouter);
app.route("/v1/users", usersRouter);
app.route("/v1/orgs", orgsRouter);

// Federation discovery
app.get(
  "/.well-known/loadclass",
  describeRoute({
    tags: ["Federation"],
    summary: "Registry metadata for federation",
    responses: {
      200: {
        description: "Registry info",
        content: { "application/json": { schema: resolver(RegistryInfo) } },
      },
    },
  }),
  async (c) => {
    const settings = await getRegistrySettings();
    return c.json({
      name: settings.name,
      url: settings.url,
      version: "1" as const,
      allowRegistration: settings.allowRegistration,
      allowPublishing: settings.allowPublishing,
      upstreamRegistries: settings.upstreamRegistries,
    });
  },
);

app.get("/health/live", (c) => c.json({ ok: true }));
app.get("/health", async (c) => {
  try {
    await Promise.all([db.execute(sql`SELECT 1`), checkStorageBucket()]);
    return c.json({ ok: true });
  } catch (error) {
    return c.json({ ok: false, error: error instanceof Error ? error.message : "unhealthy" }, 503);
  }
});

// Auto-generated OpenAPI spec
app.get(
  "/openapi.json",
  openAPISpecs(app, {
    documentation: {
      info: {
        title: "loadclass registry API",
        version: "1.0.0",
        description: "Self-hostable LaTeX template registry.",
      },
      servers: [
        { url: process.env.LOADCLASS_PUBLIC_API_URL!, description: "This instance" },
      ],
      tags: [
        { name: "Templates", description: "Browse, inspect, star, and discover templates." },
        {
          name: "Publishing",
          description: "Authenticated template publishing and release controls.",
        },
        { name: "Downloads", description: "Archive download URLs and download statistics." },
        { name: "Profiles", description: "Public user and organization profile read models." },
        { name: "Admin", description: "Authenticated registry moderation endpoints." },
        { name: "Federation", description: "Public registry discovery metadata." },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "loadclass API key",
            description: "Use a loadclass API key in the Authorization header: `Bearer <key>`.",
          },
          cookieAuth: {
            type: "apiKey",
            in: "cookie",
            name: "better-auth.session_token",
            description: "Browser session cookie used by the loadclass web app.",
          },
        },
      },
    },
  }),
);

// Scalar API reference UI at /docs
app.get(
  "/docs",
  apiReference({
    theme: "default",
    spec: { url: "/openapi.json" },
  }),
);

ensureStorageBucket().catch((error) => {
  console.error("[storage] failed to ensure bucket:", error);
});

const PORT = Number.parseInt(process.env.PORT ?? "8080", 10);
export default { fetch: app.fetch, port: PORT };
