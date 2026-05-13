import { distTags, stars, templateVersions, templates } from "@loadclass/db";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { readStorageObject } from "../storage.ts";
import { RegistryError } from "./errors.ts";
import {
  assertCanManageTemplate,
  type TemplateManagementScope,
  type TemplateRow,
} from "./ownership.ts";
import type { RegistryStore } from "./store.ts";
import { yankVersion } from "./version-state.ts";

const DistTagName = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9._-]*$/);

async function getTemplateByName(store: RegistryStore, templateName: string): Promise<TemplateRow> {
  const tmpl = await store.query.templates.findFirst({ where: eq(templates.name, templateName) });
  if (!tmpl) throw new RegistryError("Not found", 404);
  return tmpl;
}

async function withStewardship<T>(
  store: RegistryStore,
  templateName: string,
  userId: string,
  scope: TemplateManagementScope | undefined,
  fn: (tmpl: TemplateRow) => Promise<T>,
): Promise<T> {
  const tmpl = await getTemplateByName(store, templateName);
  await assertCanManageTemplate(store, userId, tmpl, scope);
  return fn(tmpl);
}

function parseManageableDistTag(tag: string): string {
  const parsed = DistTagName.safeParse(tag);
  if (!parsed.success) throw new RegistryError("Invalid dist-tag name", 400);
  if (parsed.data === "latest") {
    throw new RegistryError("latest is managed automatically", 400);
  }
  return parsed.data;
}

export async function starTemplate(
  store: RegistryStore,
  userId: string,
  templateName: string,
): Promise<void> {
  const tmpl = await getTemplateByName(store, templateName);
  const inserted = await store
    .insert(stars)
    .values({ userId, templateId: tmpl.id })
    .onConflictDoNothing()
    .returning();

  if (inserted.length > 0) {
    await store
      .update(templates)
      .set({ starCount: sql`${templates.starCount} + 1` })
      .where(eq(templates.id, tmpl.id));
  }
}

export async function unstarTemplate(
  store: RegistryStore,
  userId: string,
  templateName: string,
): Promise<void> {
  const tmpl = await getTemplateByName(store, templateName);
  const deleted = await store
    .delete(stars)
    .where(and(eq(stars.userId, userId), eq(stars.templateId, tmpl.id)))
    .returning();

  if (deleted.length > 0) {
    await store
      .update(templates)
      .set({ starCount: sql`greatest(${templates.starCount} - 1, 0)` })
      .where(eq(templates.id, tmpl.id));
  }
}

export async function deprecateTemplate(
  store: RegistryStore,
  {
    userId,
    templateName,
    message,
    scope,
  }: {
    userId: string;
    templateName: string;
    message: string | undefined;
    scope?: TemplateManagementScope;
  },
): Promise<void> {
  await withStewardship(store, templateName, userId, scope, async (tmpl) => {
    await store
      .update(templates)
      .set({ isDeprecated: true, deprecationMessage: message ?? null })
      .where(eq(templates.id, tmpl.id));
  });
}

export async function restoreDeprecatedTemplate(
  store: RegistryStore,
  {
    userId,
    templateName,
    scope,
  }: {
    userId: string;
    templateName: string;
    scope?: TemplateManagementScope;
  },
): Promise<void> {
  await withStewardship(store, templateName, userId, scope, async (tmpl) => {
    await store
      .update(templates)
      .set({ isDeprecated: false, deprecationMessage: null })
      .where(eq(templates.id, tmpl.id));
  });
}

export async function setDistTag(
  store: RegistryStore,
  {
    userId,
    templateName,
    tag,
    version,
    scope,
  }: {
    userId: string;
    templateName: string;
    tag: string;
    version: string;
    scope?: TemplateManagementScope;
  },
): Promise<{ tag: string; version: string }> {
  const parsedTag = parseManageableDistTag(tag);
  return withStewardship(store, templateName, userId, scope, async (tmpl) => {
    const targetVersion = await store.query.templateVersions.findFirst({
      where: and(
        eq(templateVersions.templateId, tmpl.id),
        eq(templateVersions.version, version),
        eq(templateVersions.isYanked, false),
      ),
    });
    if (!targetVersion) throw new RegistryError("Version not found or yanked", 404);

    await store
      .insert(distTags)
      .values({ templateId: tmpl.id, tag: parsedTag, version })
      .onConflictDoUpdate({
        target: [distTags.templateId, distTags.tag],
        set: { version, updatedAt: new Date() },
      });

    return { tag: parsedTag, version };
  });
}

export async function deleteDistTag(
  store: RegistryStore,
  {
    userId,
    templateName,
    tag,
    scope,
  }: {
    userId: string;
    templateName: string;
    tag: string;
    scope?: TemplateManagementScope;
  },
): Promise<void> {
  const parsedTag = parseManageableDistTag(tag);
  await withStewardship(store, templateName, userId, scope, async (tmpl) => {
    await store
      .delete(distTags)
      .where(and(eq(distTags.templateId, tmpl.id), eq(distTags.tag, parsedTag)));
  });
}

export async function yankTemplateVersion(
  store: RegistryStore,
  {
    userId,
    templateName,
    version,
    reason,
    scope,
  }: {
    userId: string;
    templateName: string;
    version: string;
    reason: string | undefined;
    scope?: TemplateManagementScope;
  },
): Promise<void> {
  await withStewardship(store, templateName, userId, scope, async (tmpl) => {
    await yankVersion(store, tmpl, version, reason);
  });
}

// Admin template actions bypass stewardship — authorization is enforced at the route boundary.
export async function setTemplateVerification(
  store: RegistryStore,
  templateName: string,
  isVerified: boolean,
): Promise<{ name: string; isVerified: boolean }> {
  const tmpl = await getTemplateByName(store, templateName);
  await store.update(templates).set({ isVerified }).where(eq(templates.name, templateName));
  return { name: tmpl.name, isVerified };
}

export async function readTemplateThumbnail(
  store: RegistryStore,
  templateName: string,
): Promise<{
  body: Buffer;
  contentType: string;
}> {
  const tmpl = await getTemplateByName(store, templateName);
  if (!tmpl.thumbnailUrl?.startsWith("s3://")) throw new RegistryError("Not found", 404);

  const key = tmpl.thumbnailUrl.slice("s3://".length);
  const object = await readStorageObject(key);
  if (!object.Body) throw new RegistryError("Not found", 404);

  const bytes = await object.Body.transformToByteArray();
  return {
    body: Buffer.from(bytes),
    contentType: object.ContentType ?? "application/octet-stream",
  };
}
