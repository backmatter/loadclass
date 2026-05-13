import type { Context, MiddlewareHandler } from "hono";
import { isProductionRuntime } from "../runtime-config.ts";

export function corsOrigins(): string[] {
  const origins = new Set([
    ...commaSeparated(process.env.CORS_ORIGINS),
    ...commaSeparated(process.env.CITET_ORIGINS),
    ...urlOrigin(process.env.LOADCLASS_SITE_URL),
    ...urlOrigin(process.env.LOADCLASS_CITET_URL),
  ]);

  if (!isProductionRuntime()) {
    origins.add("http://localhost:3000");
    origins.add("http://localhost:3001");
    if (origins.size === 0) origins.add("http://localhost:3001");
  }

  return [...origins];
}

export function cookieMutationOriginGuard(allowedOrigins: string[]): MiddlewareHandler {
  const allowed = new Set(allowedOrigins);

  return async (c, next) => {
    if (isReadMethod(c) || isApiKeyRequest(c) || !c.get("user")) {
      await next();
      return;
    }

    const origin = browserMutationOrigin(c);
    if ((origin && allowed.has(origin)) || (!origin && sameSiteFetchMetadata(c))) {
      await next();
      return;
    }

    return c.json(
      {
        error: "Forbidden",
        code: "forbidden_origin",
        detail: "Cookie-authenticated mutations must come from a trusted browser origin.",
      },
      403,
    );
  };
}

function commaSeparated(value: string | undefined) {
  return value
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];
}

function urlOrigin(value: string | undefined) {
  if (!value) return [];
  try {
    return [new URL(value).origin];
  } catch {
    return [];
  }
}

function isReadMethod(c: Context): boolean {
  return c.req.method === "GET" || c.req.method === "HEAD" || c.req.method === "OPTIONS";
}

function isApiKeyRequest(c: Context): boolean {
  const authorization = c.req.header("authorization");
  return Boolean(authorization?.startsWith("Bearer ") || c.req.header("x-api-key"));
}

function originFromReferer(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function browserMutationOrigin(c: Context): string | null {
  return c.req.header("origin") ?? originFromReferer(c.req.header("referer"));
}

function sameSiteFetchMetadata(c: Context): boolean {
  const site = c.req.header("sec-fetch-site");
  return site === "same-origin" || site === "same-site";
}
