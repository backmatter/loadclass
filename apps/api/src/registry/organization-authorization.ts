import { member } from "@loadclass/db";
import { eq } from "drizzle-orm";
import { auth } from "../auth.ts";
import { templatePublishPermissions } from "./organization-permissions.ts";
import type { TemplateManagementScope } from "./ownership.ts";
import type { RegistryStore } from "./store.ts";

export async function templateManagementScopeForRequest({
  store,
  userId,
  headers,
}: {
  store: RegistryStore;
  userId: string;
  headers: Headers;
}): Promise<TemplateManagementScope> {
  const memberships = await store
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, userId));

  const organizationPermissions = await Promise.all(
    memberships.map(async ({ organizationId }) => {
      const result = await auth.api.hasPermission({
        headers,
        body: {
          organizationId,
          permissions: templatePublishPermissions,
        },
      });
      return { organizationId, canManageTemplates: result.success };
    }),
  );

  return {
    organizationIds: organizationPermissions
      .filter((permission) => permission.canManageTemplates)
      .map((permission) => permission.organizationId),
  };
}
