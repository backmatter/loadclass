import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { isRegistryError } from "../registry/errors.ts";

export function registryErrorResponse(c: Context, error: unknown) {
  if (isRegistryError(error)) {
    return c.json(
      {
        error: error.message,
        ...(error.code ? { code: error.code } : {}),
        ...(error.detail ? { detail: error.detail } : {}),
      },
      error.status,
    );
  }

  throw error;
}

export async function registryRespond<T>(
  c: Context,
  fn: () => T | Promise<T>,
  status?: ContentfulStatusCode,
) {
  try {
    const result = await fn();
    if (result === undefined) return c.body(null, 204);
    return c.json(result as object, status ?? 200);
  } catch (error) {
    return registryErrorResponse(c, error);
  }
}
