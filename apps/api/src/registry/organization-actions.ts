import { organization } from "@loadclass/db";
import { eq } from "drizzle-orm";
import { RegistryError } from "./errors.ts";
import type { RegistryStore } from "./store.ts";

// Admin organization actions bypass stewardship — authorization is enforced at the route boundary.
export async function setOrganizationVerification(
  store: RegistryStore,
  slug: string,
  isVerified: boolean,
): Promise<{ slug: string; isVerified: boolean }> {
  const org = await store.query.organization.findFirst({ where: eq(organization.slug, slug) });
  if (!org) throw new RegistryError("Organization not found", 404);

  await store
    .update(organization)
    .set({ isVerified, verifiedAt: isVerified ? new Date() : null })
    .where(eq(organization.slug, slug));

  return { slug: org.slug, isVerified };
}
