import { createMiddleware } from "hono/factory";

export const requireAuth = createMiddleware(async (c, next) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  await next();
});

export const optionalAuth = createMiddleware(async (c, next) => {
  await next();
});

export const requireAdmin = createMiddleware(async (c, next) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  // Better Auth admin plugin sets role to "admin" on promoted users
  if (user.role !== "admin") return c.json({ error: "Forbidden" }, 403);
  await next();
});
