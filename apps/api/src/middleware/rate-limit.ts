import type { Context, MiddlewareHandler } from "hono";
import { getConnInfo } from "hono/bun";
import { pool } from "@loadclass/db";
import {
  RateLimiterMemory,
  RateLimiterPostgres,
  RateLimiterRes,
} from "rate-limiter-flexible";

const ONE_MINUTE_MS = 60_000;
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;
const POSTGRES_TABLE = "rate_limit_flexible";

export type RateLimitInfo = {
  limit: number;
  used: number;
  remaining: number;
  resetTime: Date | undefined;
};

type FlexibleLimiter = {
  points: number;
  duration: number;
  consume(key: string | number, points?: number): Promise<RateLimiterRes>;
};

type RuntimeLimiter = {
  limiter: FlexibleLimiter;
  ready: Promise<void>;
};

function configuredInt(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function configuredStore() {
  return (process.env.RATE_LIMIT_STORE ?? "postgres").trim().toLowerCase();
}

function proxyHeaderEnabled() {
  return process.env.TRUST_PROXY_HEADERS === "true";
}

function headerIp(value: string | undefined): string | undefined {
  const ip = value?.split(",")[0]?.trim();
  return ip ? ip.slice(0, 128) : undefined;
}

function connectionIp(c: Context): string | undefined {
  try {
    const ip = getConnInfo(c).remote.address?.trim();
    return ip ? ip.slice(0, 128) : undefined;
  } catch {
    return undefined;
  }
}

export function clientIp(c: Context): string {
  if (proxyHeaderEnabled()) {
    const cloudflareIp = headerIp(c.req.header("cf-connecting-ip"));
    if (cloudflareIp) return cloudflareIp;

    const trueClientIp = headerIp(c.req.header("true-client-ip"));
    if (trueClientIp) return trueClientIp;

    const realIp = headerIp(c.req.header("x-real-ip"));
    if (realIp) return realIp;

    const forwardedFor = headerIp(c.req.header("x-forwarded-for"));
    if (forwardedFor) return forwardedFor;
  }

  return connectionIp(c) ?? "unknown";
}

function userOrIpKey(c: Context): string {
  const user = c.get("user");
  return user?.id ? `user:${user.id}` : `ip:${clientIp(c)}`;
}

function userKey(c: Context): string {
  const user = c.get("user");
  return user?.id ? `user:${user.id}` : `ip:${clientIp(c)}`;
}

function ipKey(c: Context): string {
  return `ip:${clientIp(c)}`;
}

function skipOptions(c: Context): boolean {
  return c.req.method === "OPTIONS";
}

function skipReadMethods(c: Context): boolean {
  return c.req.method === "GET" || c.req.method === "HEAD" || c.req.method === "OPTIONS";
}

function durationSeconds(windowMs: number): number {
  return Math.max(1, Math.ceil(windowMs / 1000));
}

function createLimiter(prefix: string, windowMs: number, limit: number): RuntimeLimiter {
  const duration = durationSeconds(windowMs);

  if (configuredStore() !== "postgres") {
    return {
      limiter: new RateLimiterMemory({
        keyPrefix: prefix,
        points: limit,
        duration,
      }),
      ready: Promise.resolve(),
    };
  }

  return {
    limiter: new RateLimiterPostgres({
      storeClient: pool,
      storeType: "pool",
      tableName: POSTGRES_TABLE,
      tableCreated: true,
      keyPrefix: prefix,
      points: limit,
      duration,
      clearExpiredByTimeout: true,
      inMemoryBlockOnConsumed: limit + 1,
      inMemoryBlockDuration: duration,
    }),
    ready: Promise.resolve(),
  };
}

function isRateLimiterResult(value: unknown): value is RateLimiterRes {
  return (
    value instanceof RateLimiterRes ||
    (typeof value === "object" &&
      value !== null &&
      "msBeforeNext" in value &&
      "remainingPoints" in value &&
      "consumedPoints" in value)
  );
}

function resetTimeFrom(result: RateLimiterRes): Date | undefined {
  return result.msBeforeNext >= 0 ? new Date(Date.now() + result.msBeforeNext) : undefined;
}

function retryAfterSeconds(result: RateLimiterRes): number {
  return Math.max(1, Math.ceil(Math.max(result.msBeforeNext, 0) / 1000));
}

function setRateLimitHeaders(c: Context, limit: number, result: RateLimiterRes) {
  const remaining = Math.max(result.remainingPoints, 0);
  const resetTime = resetTimeFrom(result);

  c.set("rateLimit", {
    limit,
    used: Math.max(result.consumedPoints, 0),
    remaining,
    resetTime,
  } satisfies RateLimitInfo);

  c.header("RateLimit-Limit", String(limit));
  c.header("RateLimit-Remaining", String(remaining));
  if (resetTime) c.header("RateLimit-Reset", String(retryAfterSeconds(result)));
}

function rateLimitedBody(limitName: string, result: RateLimiterRes) {
  const resetTime = resetTimeFrom(result);
  const detail = resetTime
    ? `Try again after ${resetTime.toISOString()}.`
    : "Try again later.";

  return {
    error: "Too many requests.",
    code: "rate_limited",
    detail: `${limitName} rate limit exceeded. ${detail}`,
  };
}

function makeLimiter({
  name,
  prefix,
  windowMs,
  limit,
  keyGenerator,
  skip,
}: {
  name: string;
  prefix: string;
  windowMs: number;
  limit: number;
  keyGenerator: (c: Context) => string;
  skip?: (c: Context) => boolean;
}): MiddlewareHandler {
  const runtime = createLimiter(prefix, windowMs, limit);

  return async (c, next) => {
    if (skip?.(c)) {
      await next();
      return;
    }

    try {
      await runtime.ready;
      const result = await runtime.limiter.consume(keyGenerator(c));
      setRateLimitHeaders(c, limit, result);
      await next();
    } catch (error) {
      if (isRateLimiterResult(error)) {
        setRateLimitHeaders(c, limit, error);
        c.header("Retry-After", String(retryAfterSeconds(error)));
        return c.json(rateLimitedBody(name, error), 429);
      }

      console.error("[rate-limit] limiter unavailable:", error);
      return c.json(
        {
          error: "Rate limiter unavailable.",
          code: "rate_limit_unavailable",
          detail: "Try again later.",
        },
        503,
      );
    }
  };
}

export const authRateLimit = makeLimiter({
  name: "Authentication",
  prefix: "auth",
  windowMs: ONE_MINUTE_MS,
  limit: configuredInt("RATE_LIMIT_AUTH_PER_MINUTE", 20),
  keyGenerator: ipKey,
  skip: skipOptions,
});

export const apiRateLimit = makeLimiter({
  name: "API",
  prefix: "api",
  windowMs: ONE_MINUTE_MS,
  limit: configuredInt("RATE_LIMIT_API_PER_MINUTE", 600),
  keyGenerator: userOrIpKey,
  skip: skipOptions,
});

export const mutationRateLimit = makeLimiter({
  name: "Mutation",
  prefix: "mutation",
  windowMs: ONE_MINUTE_MS,
  limit: configuredInt("RATE_LIMIT_MUTATION_PER_MINUTE", 120),
  keyGenerator: userOrIpKey,
  skip: skipReadMethods,
});

export const downloadRateLimit = makeLimiter({
  name: "Download",
  prefix: "download",
  windowMs: ONE_MINUTE_MS,
  limit: configuredInt("RATE_LIMIT_DOWNLOAD_PER_MINUTE", 120),
  keyGenerator: ipKey,
  skip: skipOptions,
});

export const publishUserRateLimit = makeLimiter({
  name: "Publishing",
  prefix: "publish-user",
  windowMs: ONE_HOUR_MS,
  limit: configuredInt("RATE_LIMIT_PUBLISH_PER_HOUR", 5),
  keyGenerator: userKey,
  skip: skipOptions,
});

export const publishIpRateLimit = makeLimiter({
  name: "Publishing IP",
  prefix: "publish-ip",
  windowMs: ONE_HOUR_MS,
  limit: configuredInt("RATE_LIMIT_PUBLISH_IP_PER_HOUR", 20),
  keyGenerator: ipKey,
  skip: skipOptions,
});
