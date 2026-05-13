import { db, member, organization, templateMaintainers, templates } from "@loadclass/db";
import { desc, eq, inArray } from "drizzle-orm";
import { RegistryError } from "./errors.ts";
import type { RegistryStore } from "./store.ts";

export type TemplateRow = typeof templates.$inferSelect;

export interface TemplateManagementScope {
  organizationIds: readonly string[];
}

export interface PublishOwner {
  namespace: string | null;
  ownerUserId: string | null;
  ownerOrgId: string | null;
}

export function namespaceFromTemplateName(name: string): string | null {
  if (!name.startsWith("@")) return null;

  const slash = name.indexOf("/");
  if (slash <= 1 || slash === name.length - 1) {
    throw new RegistryError("Scoped template names must look like @org/template", 400);
  }

  return name.slice(1, slash);
}

function canManageOrganizationTemplate(
  scope: TemplateManagementScope | undefined,
  organizationId: string,
): boolean {
  return scope?.organizationIds.includes(organizationId) ?? false;
}

export async function canManageTemplate(
  store: RegistryStore,
  userId: string,
  tmpl: TemplateRow,
  scope?: TemplateManagementScope,
): Promise<boolean> {
  if (tmpl.ownerUserId === userId) return true;

  if (tmpl.ownerOrgId) {
    if (canManageOrganizationTemplate(scope, tmpl.ownerOrgId)) return true;
  }

  const maintainer = await store.query.templateMaintainers.findFirst({
    where: (tm, { and, eq }) => and(eq(tm.templateId, tmpl.id), eq(tm.userId, userId)),
  });

  return maintainer != null;
}

export async function assertCanManageTemplate(
  store: RegistryStore,
  userId: string,
  tmpl: TemplateRow,
  scope?: TemplateManagementScope,
): Promise<void> {
  if (!(await canManageTemplate(store, userId, tmpl, scope))) {
    throw new RegistryError("Forbidden", 403);
  }
}

export async function resolvePublishOwner(
  store: RegistryStore,
  userId: string,
  templateName: string,
  existingTemplate: TemplateRow | null,
  scope?: TemplateManagementScope,
): Promise<PublishOwner> {
  const namespace = namespaceFromTemplateName(templateName);

  if (existingTemplate) {
    await assertCanManageTemplate(store, userId, existingTemplate, scope);
    return {
      namespace: existingTemplate.namespace,
      ownerUserId: existingTemplate.ownerUserId,
      ownerOrgId: existingTemplate.ownerOrgId,
    };
  }

  if (!namespace) {
    return { namespace: null, ownerUserId: userId, ownerOrgId: null };
  }

  const org = await store.query.organization.findFirst({
    where: eq(organization.slug, namespace),
  });
  if (!org) throw new RegistryError(`Organization @${namespace} not found`, 400);

  const membership = await store.query.member.findFirst({
    where: (m, { and, eq }) => and(eq(m.organizationId, org.id), eq(m.userId, userId)),
  });
  if (!membership) throw new RegistryError(`You are not a member of @${namespace}`, 403);
  if (!canManageOrganizationTemplate(scope, org.id)) {
    throw new RegistryError(`You cannot publish templates under @${namespace}`, 403);
  }

  return { namespace, ownerUserId: null, ownerOrgId: org.id };
}

export async function listManageableTemplates(
  userId: string,
  scope?: TemplateManagementScope,
): Promise<TemplateRow[]> {
  const orgIds = scope?.organizationIds ?? [];
  const [directRows, maintainerRows] = await Promise.all([
    db.select().from(templates).where(eq(templates.ownerUserId, userId)),
    db
      .select({ templateId: templateMaintainers.templateId })
      .from(templateMaintainers)
      .where(eq(templateMaintainers.userId, userId)),
  ]);

  const maintainedIds = maintainerRows.map((m) => m.templateId);

  const [orgRows, maintainedRows] = await Promise.all([
    orgIds.length > 0
      ? db.select().from(templates).where(inArray(templates.ownerOrgId, orgIds))
      : Promise.resolve([]),
    maintainedIds.length > 0
      ? db.select().from(templates).where(inArray(templates.id, maintainedIds))
      : Promise.resolve([]),
  ]);

  const byId = new Map<string, TemplateRow>();
  for (const row of [...directRows, ...orgRows, ...maintainedRows]) byId.set(row.id, row);

  return [...byId.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function listUserOwnedTemplates(userId: string): Promise<TemplateRow[]> {
  return db
    .select()
    .from(templates)
    .where(eq(templates.ownerUserId, userId))
    .orderBy(desc(templates.downloadCount));
}

export async function listOrganizationTemplates(organizationId: string): Promise<TemplateRow[]> {
  return db
    .select()
    .from(templates)
    .where(eq(templates.ownerOrgId, organizationId))
    .orderBy(desc(templates.downloadCount));
}
