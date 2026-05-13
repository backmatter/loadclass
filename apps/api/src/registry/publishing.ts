import { categories, db, templateVersions, templates } from "@loadclass/db";
import type { PublishQualityIssue, TemplateManifest } from "@loadclass/registry-contract";
import { and, eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import semver from "semver";
import { isPublishingAllowed } from "./config.ts";
import { RegistryError } from "./errors.ts";
import {
  resolvePublishOwner,
  type PublishOwner,
  type TemplateManagementScope,
  type TemplateRow,
} from "./ownership.ts";
import type { RegistryStore } from "./store.ts";
import {
  deleteArchive,
  deleteThumbnail,
  putArchive,
  putThumbnail,
} from "./template-archive-storage.ts";
import { prepareTemplatePackage } from "./template-package.ts";
import {
  generateTemplateThumbnailReport,
  type GenerateTemplateThumbnailReport,
} from "./template-preview.ts";
import { recordPublishedVersion } from "./version-state.ts";

export interface PublishTemplateVersionInput {
  userId: string;
  scope?: TemplateManagementScope;
  manifestRaw: FormDataEntryValue | null;
  archive: FormDataEntryValue | null;
}

export interface PublishTemplateVersionResult {
  name: string;
  version: string;
  archiveKey: string;
}

const DEFAULT_MAX_TEMPLATES_PER_USER = 5;
const DEFAULT_MAX_VERSIONS_PER_TEMPLATE = 10;

function maxTemplatesPerUser(): number {
  const configured = Number.parseInt(process.env.MAX_TEMPLATES_PER_USER ?? "", 10);
  return Number.isFinite(configured) ? configured : DEFAULT_MAX_TEMPLATES_PER_USER;
}

function maxVersionsPerTemplate(): number {
  const configured = Number.parseInt(process.env.MAX_VERSIONS_PER_TEMPLATE ?? "", 10);
  return Number.isFinite(configured) ? configured : DEFAULT_MAX_VERSIONS_PER_TEMPLATE;
}

async function assertCategoryExists(store: RegistryStore, category: string): Promise<void> {
  const row = await store.query.categories.findFirst({
    where: eq(categories.slug, category),
  });
  if (!row) throw new RegistryError(`Unknown category: ${category}`, 400);
}

async function assertUserTemplateQuota(
  store: RegistryStore,
  userId: string,
  existingTemplate: TemplateRow | null,
  scope?: TemplateManagementScope,
): Promise<void> {
  if (existingTemplate) return;

  const maxTemplates = maxTemplatesPerUser();
  if (maxTemplates <= 0) return;

  const orgIds = scope?.organizationIds ?? [];
  const directRows = await store
    .select({ count: sql<number>`count(*)::int` })
    .from(templates)
    .where(eq(templates.ownerUserId, userId));
  const orgRows =
    orgIds.length > 0
      ? await store
          .select({ count: sql<number>`count(*)::int` })
          .from(templates)
          .where(inArray(templates.ownerOrgId, orgIds))
      : [];
  const currentCount = Number(directRows[0]?.count ?? 0) + Number(orgRows[0]?.count ?? 0);

  if (currentCount >= maxTemplates) {
    throw new RegistryError(
      `You can publish at most ${maxTemplates} templates on this registry`,
      403,
    );
  }
}

async function assertTemplateVersionQuota(
  store: RegistryStore,
  existingTemplate: TemplateRow | null,
): Promise<void> {
  if (!existingTemplate) return;

  const maxVersions = maxVersionsPerTemplate();
  if (maxVersions <= 0) return;

  const rows = await store
    .select({ count: sql<number>`count(*)::int` })
    .from(templateVersions)
    .where(eq(templateVersions.templateId, existingTemplate.id));
  const currentCount = Number(rows[0]?.count ?? 0);

  if (currentCount >= maxVersions) {
    throw new RegistryError(
      `A template can have at most ${maxVersions} versions on this registry`,
      403,
    );
  }
}

function shouldPromoteVersion(version: string, currentLatestVersion: string | null): boolean {
  return (
    !currentLatestVersion ||
    !semver.valid(currentLatestVersion) ||
    semver.gt(version, currentLatestVersion)
  );
}

function thumbnailGateStatus(issue: PublishQualityIssue | null): 422 | 503 {
  if (
    issue?.code === "preview_worker_not_configured" ||
    issue?.code === "preview_worker_unavailable"
  ) {
    return 503;
  }
  return 422;
}

function assertGeneratedThumbnail(
  report: GenerateTemplateThumbnailReport,
): NonNullable<GenerateTemplateThumbnailReport["thumbnail"]> {
  if (report.status === "generated" && report.thumbnail) return report.thumbnail;

  const issue = report.issue ?? {
    code: "thumbnail_generation_failed",
    message: "The template must compile and generate a thumbnail before it can be published.",
  };
  throw new RegistryError(issue.message, thumbnailGateStatus(issue), issue.code, issue.detail);
}

async function assertPublishPreflight(
  store: RegistryStore,
  userId: string,
  manifest: TemplateManifest,
  scope?: TemplateManagementScope,
): Promise<{ existingTemplate: TemplateRow | null; owner: PublishOwner }> {
  await assertCategoryExists(store, manifest.category);

  const existingTemplate =
    (await store.query.templates.findFirst({
      where: eq(templates.name, manifest.name),
    })) ?? null;

  await assertUserTemplateQuota(store, userId, existingTemplate, scope);
  await assertTemplateVersionQuota(store, existingTemplate);
  const owner = await resolvePublishOwner(store, userId, manifest.name, existingTemplate, scope);

  if (existingTemplate) {
    const existingVersion = await store.query.templateVersions.findFirst({
      where: and(
        eq(templateVersions.templateId, existingTemplate.id),
        eq(templateVersions.version, manifest.version),
      ),
    });
    if (existingVersion) {
      throw new RegistryError(`${manifest.name}@${manifest.version} already exists`, 409);
    }
  }

  return { existingTemplate, owner };
}

export async function publishTemplateVersion({
  userId,
  scope,
  manifestRaw,
  archive: archiveEntry,
}: PublishTemplateVersionInput): Promise<PublishTemplateVersionResult> {
  if (!(await isPublishingAllowed())) {
    throw new RegistryError("Publishing is disabled on this registry", 403);
  }

  const { manifest, archiveBuffer, archiveKey, sha256 } = await prepareTemplatePackage({
    manifestRaw,
    archive: archiveEntry,
  });
  await assertPublishPreflight(db, userId, manifest, scope);

  const thumbnailReport = await generateTemplateThumbnailReport({
    manifest,
    archiveBuffer,
    skipIfManifestThumbnail: false,
  });
  const generatedThumbnail = assertGeneratedThumbnail(thumbnailReport);

  const generatedThumbnailUrl = `s3://${generatedThumbnail.thumbnailKey}`;
  let archiveUploaded = false;
  let thumbnailUploaded = false;

  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${manifest.name}))`);
      const { existingTemplate, owner } = await assertPublishPreflight(tx, userId, manifest, scope);
      const templateId = existingTemplate?.id ?? nanoid();

      await putArchive({ archiveKey, archiveBuffer, sha256 });
      archiveUploaded = true;
      await putThumbnail(generatedThumbnail);
      thumbnailUploaded = true;

      if (!existingTemplate) {
        await tx.insert(templates).values({
          id: templateId,
          name: manifest.name,
          title: manifest.title ?? manifest.name,
          namespace: owner.namespace,
          description: manifest.description,
          license: manifest.license,
          homepage: manifest.homepage ?? null,
          repository: manifest.repository ?? null,
          sourceType: manifest.sourceType ?? "unknown",
          sourceUrl: manifest.sourceUrl ?? null,
          publisher: manifest.publisher ?? null,
          category: manifest.category,
          readme: manifest.readme ?? "",
          ownerUserId: owner.ownerUserId,
          ownerOrgId: owner.ownerOrgId,
          thumbnailUrl: generatedThumbnailUrl,
        });
      } else if (
        generatedThumbnailUrl &&
        shouldPromoteVersion(manifest.version, existingTemplate.latestVersion)
      ) {
        await tx
          .update(templates)
          .set({ thumbnailUrl: generatedThumbnailUrl })
          .where(eq(templates.id, existingTemplate.id));
      }

      await recordPublishedVersion(
        tx,
        {
          templateId,
          version: manifest.version,
          description: manifest.description,
          archiveUrl: archiveKey,
          archiveSize: archiveBuffer.byteLength,
          archiveSha256: sha256,
          manifest,
          publishedById: userId,
        },
        existingTemplate?.latestVersion ?? null,
      );
    });
  } catch (error) {
    if (archiveUploaded) {
      await deleteArchive(archiveKey).catch((deleteError) =>
        console.error(
          "[publishing] failed to clean up archive after publish failure:",
          deleteError,
        ),
      );
    }
    if (thumbnailUploaded && generatedThumbnail) {
      await deleteThumbnail(generatedThumbnail.thumbnailKey).catch((deleteError) =>
        console.error(
          "[publishing] failed to clean up thumbnail after publish failure:",
          deleteError,
        ),
      );
    }
    throw error;
  }

  return {
    name: manifest.name,
    version: manifest.version,
    archiveKey,
  };
}
