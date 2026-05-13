import { db, distTags, templateVersions, templates } from "@loadclass/db";
import { and, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import semver from "semver";
import { RegistryError } from "./errors.ts";
import { type TemplateRow } from "./ownership.ts";
import type { RegistryStore } from "./store.ts";

export interface PublishedVersion {
  templateId: string;
  version: string;
  description: string;
  archiveUrl: string;
  archiveSize: number;
  archiveSha256: string;
  manifest: unknown;
  publishedById: string;
}

export function highestActiveVersion(versions: Array<{ version: string }>): string | null {
  return (
    versions
      .map((v) => v.version)
      .filter((version) => semver.valid(version))
      .sort((a, b) => semver.rcompare(a, b))[0] ?? null
  );
}

async function setLatestVersion(
  store: RegistryStore,
  templateId: string,
  version: string | null,
): Promise<void> {
  await store
    .update(templates)
    .set({ latestVersion: version, updatedAt: new Date() })
    .where(eq(templates.id, templateId));

  if (version) {
    await store
      .insert(distTags)
      .values({ templateId, tag: "latest", version })
      .onConflictDoUpdate({
        target: [distTags.templateId, distTags.tag],
        set: { version, updatedAt: new Date() },
      });
    return;
  }

  await store.delete(distTags).where(and(eq(distTags.templateId, templateId), eq(distTags.tag, "latest")));
}

export async function recordPublishedVersion(
  store: RegistryStore,
  release: PublishedVersion,
  currentLatestVersion: string | null,
): Promise<void> {
  await store.insert(templateVersions).values({
    id: nanoid(),
    templateId: release.templateId,
    version: release.version,
    description: release.description,
    archiveUrl: release.archiveUrl,
    archiveSize: release.archiveSize,
    archiveSha256: release.archiveSha256,
    manifest: release.manifest,
    publishedById: release.publishedById,
  });

  if (
    !currentLatestVersion ||
    !semver.valid(currentLatestVersion) ||
    semver.gt(release.version, currentLatestVersion)
  ) {
    await setLatestVersion(store, release.templateId, release.version);
  }
}

export async function yankVersion(
  store: RegistryStore,
  tmpl: TemplateRow,
  version: string,
  reason: string | undefined,
): Promise<void> {
  const updated = await store
    .update(templateVersions)
    .set({ isYanked: true, yankedReason: reason ?? null })
    .where(and(eq(templateVersions.templateId, tmpl.id), eq(templateVersions.version, version)))
    .returning({ version: templateVersions.version });

  if (updated.length === 0) throw new RegistryError("Version not found", 404);

  if (tmpl.latestVersion !== version) return;

  const activeVersions = await store
    .select({ version: templateVersions.version })
    .from(templateVersions)
    .where(and(eq(templateVersions.templateId, tmpl.id), eq(templateVersions.isYanked, false)));

  await setLatestVersion(store, tmpl.id, highestActiveVersion(activeVersions));
}

export async function incrementVersionDownloadCount(versionId: string): Promise<void> {
  await db
    .update(templateVersions)
    .set({ downloadCount: sql`${templateVersions.downloadCount} + 1` })
    .where(eq(templateVersions.id, versionId));
}
