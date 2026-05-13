import { resolver } from "hono-openapi/zod";
import { ErrorResponse } from "./schemas.ts";

export const authSecurity = [{ bearerAuth: [] }, { cookieAuth: [] }];

export const unauthorizedResponse = {
  description: "Authentication required",
  content: { "application/json": { schema: resolver(ErrorResponse) } },
};

export const forbiddenResponse = {
  description: "Forbidden",
  content: { "application/json": { schema: resolver(ErrorResponse) } },
};

export const notFoundResponse = {
  description: "Not found",
  content: { "application/json": { schema: resolver(ErrorResponse) } },
};
