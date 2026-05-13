import { templateThumbnailPath } from "@loadclass/registry-contract";
import {
  categories,
  db,
  distTags,
  member,
  organization,
  templateVersions,
  templates,
  user as userTable,
} from "@loadclass/db";
import { and, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { RegistryError } from "./errors.ts";
import {
  canManageTemplate,
  listOrganizationTemplates,
  listUserOwnedTemplates,
  type TemplateManagementScope,
  type TemplateRow,
} from "./ownership.ts";
import { fetchUpstreamTemplateDetail } from "./upstream.ts";

type TemplateVersionRow = typeof templateVersions.$inferSelect;

function publicThumbnailUrl(row: TemplateRow): string | null {
  if (!row.thumbnailUrl) return null;
  if (row.thumbnailUrl.startsWith("s3://")) {
    return templateThumbnailPath(row.name);
  }
  return row.thumbnailUrl;
}

export type TemplateSort = "weekly_downloads" | "downloads" | "stars" | "newest";

export interface TemplateSearch {
  q: string | undefined;
  category: string | undefined;
  sort: TemplateSort;
  page: number;
  perPage: number;
}

export function toTemplateSummary(row: TemplateRow, verification: { orgVerified?: boolean } = {}) {
  const isOrgVerified = verification.orgVerified ?? false;
  const isTemplateVerified = row.isVerified;

  return {
    id: row.id,
    name: row.name,
    title: row.title,
    namespace: row.namespace,
    description: row.description,
    license: row.license,
    homepage: row.homepage,
    repository: row.repository,
    sourceType: row.sourceType,
    sourceUrl: row.sourceUrl,
    publisher: row.publisher,
    category: row.category,
    readme: row.readme,
    thumbnailUrl: publicThumbnailUrl(row),
    ownerUserId: row.ownerUserId,
    ownerOrgId: row.ownerOrgId,
    isVerified: isTemplateVerified || isOrgVerified,
    isTemplateVerified,
    isOrgVerified,
    isDeprecated: row.isDeprecated,
    deprecationMessage: row.deprecationMessage,
    isLocal: true,
    upstreamRegistry: null,
    latestVersion: row.latestVersion,
    downloadCount: row.downloadCount,
    weeklyDownloads: row.weeklyDownloads,
    starCount: row.starCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toVersionSummary(row: TemplateVersionRow) {
  return {
    id: row.id,
    templateId: row.templateId,
    version: row.version,
    description: row.description,
    archiveUrl: row.archiveUrl,
    archiveSize: row.archiveSize,
    archiveSha256: row.archiveSha256,
    manifest: row.manifest,
    publishedById: row.publishedById,
    isYanked: row.isYanked,
    yankedReason: row.yankedReason,
    downloadCount: row.downloadCount,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listTemplatesPage(search: TemplateSearch) {
  const conditions: SQL[] = [];

  if (search.q) {
    const searchCondition = or(
      ilike(templates.name, `%${search.q}%`),
      ilike(templates.title, `%${search.q}%`),
      ilike(templates.description, `%${search.q}%`),
    );
    if (searchCondition) conditions.push(searchCondition);
  }
  if (search.category) conditions.push(eq(templates.category, search.category));

  const orderBy =
    search.sort === "weekly_downloads"
      ? desc(templates.weeklyDownloads)
      : search.sort === "downloads"
        ? desc(templates.downloadCount)
        : search.sort === "stars"
          ? desc(templates.starCount)
          : desc(templates.createdAt);

  const where = conditions.length ? and(...conditions) : undefined;
  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(templates)
      .where(where)
      .orderBy(orderBy)
      .limit(search.perPage)
      .offset((search.page - 1) * search.perPage),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(templates)
      .where(where),
  ]);

  const orgVerification = await getOrganizationVerification(rows);

  return {
    templates: rows.map((row) =>
      toTemplateSummary(row, {
        orgVerified: row.ownerOrgId ? (orgVerification.get(row.ownerOrgId) ?? false) : false,
      }),
    ),
    total: Number(countRows[0]?.count ?? 0),
    page: search.page,
    perPage: search.perPage,
  };
}

async function getOrganizationVerification(rows: TemplateRow[]) {
  const orgIds = [...new Set(rows.map((row) => row.ownerOrgId).filter((id) => id != null))];
  const orgVerification = new Map<string, boolean>();
  if (orgIds.length > 0) {
    const orgRows = await db
      .select({ id: organization.id, isVerified: organization.isVerified })
      .from(organization)
      .where(inArray(organization.id, orgIds));
    for (const row of orgRows) orgVerification.set(row.id, row.isVerified);
  }
  return orgVerification;
}

export async function listManageableTemplatesPage(rows: TemplateRow[]) {
  const orgVerification = await getOrganizationVerification(rows);

  return {
    templates: rows.map((row) =>
      toTemplateSummary(row, {
        orgVerified: row.ownerOrgId ? (orgVerification.get(row.ownerOrgId) ?? false) : false,
      }),
    ),
    total: rows.length,
    page: 1,
    perPage: rows.length,
  };
}

export async function getTemplateDetail(
  templateName: string,
  userId?: string,
  scope?: TemplateManagementScope,
) {
  const tmpl = await db.query.templates.findFirst({ where: eq(templates.name, templateName) });
  if (!tmpl) {
    const upstream = await fetchUpstreamTemplateDetail(templateName);
    if (upstream) return upstream;
    throw new RegistryError("Template not found", 404);
  }

  const [versions, tags, starRow, ownerInfo] = await Promise.all([
    db
      .select()
      .from(templateVersions)
      .where(eq(templateVersions.templateId, tmpl.id))
      .orderBy(desc(templateVersions.createdAt)),
    db.select().from(distTags).where(eq(distTags.templateId, tmpl.id)),
    userId
      ? db.query.stars.findFirst({
          where: (s, { and, eq }) => and(eq(s.userId, userId), eq(s.templateId, tmpl.id)),
        })
      : Promise.resolve(null),
    tmpl.ownerUserId
      ? db.query.user.findFirst({
          where: eq(userTable.id, tmpl.ownerUserId),
          columns: { id: true, name: true, image: true },
        })
      : tmpl.ownerOrgId
        ? db.query.organization.findFirst({
            where: eq(organization.id, tmpl.ownerOrgId),
            columns: { id: true, name: true, slug: true, isVerified: true, logo: true },
          })
        : Promise.resolve(null),
  ]);

  const owner =
    ownerInfo && "slug" in ownerInfo
      ? { type: "org" as const, ...ownerInfo }
      : ownerInfo
        ? { type: "user" as const, ...ownerInfo }
        : null;

  const isOrgVerified = owner?.type === "org" ? owner.isVerified : false;
  const canManage = userId ? await canManageTemplate(db, userId, tmpl, scope) : false;

  return {
    ...toTemplateSummary(tmpl, { orgVerified: isOrgVerified }),
    owner,
    isStarred: starRow != null,
    canManage,
    versions: versions.map(toVersionSummary),
    distTags: Object.fromEntries(tags.map((tag) => [tag.tag, tag.version])),
  };
}

export async function getUserProfile(userId: string) {
  const user = await db.query.user.findFirst({ where: eq(userTable.id, userId) });
  if (!user) throw new RegistryError("User not found", 404);

  return {
    id: user.id,
    name: user.name,
    image: user.image,
    createdAt: user.createdAt.toISOString(),
    templates: (await listUserOwnedTemplates(userId)).map((template) =>
      toTemplateSummary(template),
    ),
  };
}

export async function getOrganizationProfile(slug: string) {
  const org = await db.query.organization.findFirst({ where: eq(organization.slug, slug) });
  if (!org) throw new RegistryError("Organization not found", 404);

  const [orgTemplates, members] = await Promise.all([
    listOrganizationTemplates(org.id),
    db
      .select({ id: userTable.id, name: userTable.name, image: userTable.image, role: member.role })
      .from(member)
      .innerJoin(userTable, eq(member.userId, userTable.id))
      .where(eq(member.organizationId, org.id)),
  ]);

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    logo: org.logo,
    isVerified: org.isVerified,
    createdAt: org.createdAt.toISOString(),
    templates: orgTemplates.map((template) =>
      toTemplateSummary(template, { orgVerified: org.isVerified }),
    ),
    members,
  };
}

export async function listCategorySummaries() {
  const rows = await db
    .select({
      slug: categories.slug,
      label: categories.label,
      description: categories.description,
      templateCount: sql<number>`count(${templates.id})::int`,
    })
    .from(categories)
    .leftJoin(templates, eq(templates.category, categories.slug))
    .groupBy(categories.slug, categories.label, categories.description, categories.displayOrder)
    .orderBy(categories.displayOrder);

  return rows.map((row) => ({ ...row, templateCount: Number(row.templateCount) }));
}

export async function listAdminTemplates() {
  const rows = await db.select().from(templates).orderBy(desc(templates.createdAt));
  const orgVerification = await getOrganizationVerification(rows);
  return {
    templates: rows.map((row) =>
      toTemplateSummary(row, {
        orgVerified: row.ownerOrgId ? (orgVerification.get(row.ownerOrgId) ?? false) : false,
      }),
    ),
  };
}

export async function listAdminOrganizations() {
  const rows = await db.select().from(organization).orderBy(organization.name);
  return { orgs: rows };
}
