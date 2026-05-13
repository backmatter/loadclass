import type { auth } from "./auth.ts";
import type { RateLimitInfo } from "./middleware/rate-limit.ts";

type Session = typeof auth.$Infer.Session;

declare module "hono" {
  interface ContextVariableMap {
    user: Session["user"];
    session: Session["session"];
    rateLimit: RateLimitInfo;
  }
}
