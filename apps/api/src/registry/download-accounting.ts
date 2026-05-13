import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DOWNLOAD_SOURCES, type DownloadSource } from "@loadclass/registry-contract";
import {
  db,
  downloadEvents,
  templateVersions,
  templates,
  weeklyDownloadSnapshots,
} from "@loadclass/db";
import { and, eq, gte, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { createHash } from "node:crypto";
import { BUCKET, s3 } from "../storage.ts";
import { RegistryError } from "./errors.ts";
import { fetchUpstreamDownloadUrl } from "./upstream.ts";

export type DownloadStatsPeriod = "day" | "week" | "month";

export interface PrepareTemplateDownloadInput {
  templateName: string;
  version: string;
  ipAddress: string;
  userAgent: string | null;
  source: string | null | undefined;
}

export interface PreparedTemplateDownload {
  url: string;
  sha256: string;
  size: number;
  filename: string;
}

function normalizeDownloadSource(source: string | null | undefined): DownloadSource {
  if (DOWNLOAD_SOURCES.includes(source as DownloadSource)) return source as DownloadSource;
  return "api";
}

function hashIpAddress(ipAddress: string): string | null {
  if (!ipAddress) return null;
  const salt =
    process.env.DOWNLOAD_IP_HASH_SALT ?? process.env.BETTER_AUTH_SECRET ?? "loadclass-dev";
  return createHash("sha256").update(`${salt}:${ipAddress}`).digest("hex");
}

function archiveDownloadFilename(templateName: string, version: string): string {
  return `${templateName.replaceAll("/", "-")}-${version}.tar.gz`;
}

async function recordDownloadEvent({
  templateId,
  versionId,
  ipHash,
  userAgent,
  source,
}: {
  templateId: string;
  versionId: string;
  ipHash: string | null;
  userAgent: string | null;
  source: DownloadSource;
}): Promise<void> {
  const windowStart = new Date(Date.now() - 60 * 60 * 1000);
  await db.transaction(async (tx) => {
    if (ipHash) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`${versionId}:${ipHash}`}))`);
    }

    const alreadyCounted = ipHash
      ? await tx.query.downloadEvents.findFirst({
          where: and(
            eq(downloadEvents.versionId, versionId),
            eq(downloadEvents.ipHash, ipHash),
            gte(downloadEvents.downloadedAt, windowStart),
          ),
        })
      : null;

    await tx.insert(downloadEvents).values({
      id: nanoid(),
      templateId,
      versionId,
      ipHash,
      userAgent,
      source,
    });

    if (alreadyCounted) return;

    await Promise.all([
      tx
        .update(templates)
        .set({ downloadCount: sql`${templates.downloadCount} + 1` })
        .where(eq(templates.id, templateId)),
      tx
        .update(templateVersions)
        .set({ downloadCount: sql`${templateVersions.downloadCount} + 1` })
        .where(eq(templateVersions.id, versionId)),
    ]);
  });
}

export async function prepareTemplateDownload({
  templateName,
  version,
  ipAddress,
  userAgent,
  source,
}: PrepareTemplateDownloadInput): Promise<PreparedTemplateDownload> {
  const tmpl = await db.query.templates.findFirst({
    where: eq(templates.name, templateName),
  });
  if (!tmpl) {
    const upstream = await fetchUpstreamDownloadUrl({ templateName, version, source });
    if (upstream) return upstream;
    throw new RegistryError("Not found", 404);
  }

  const ver = await db.query.templateVersions.findFirst({
    where: and(eq(templateVersions.templateId, tmpl.id), eq(templateVersions.version, version)),
  });
  if (!ver) {
    const upstream = await fetchUpstreamDownloadUrl({ templateName, version, source });
    if (upstream) return upstream;
    throw new RegistryError("Version not found", 404);
  }
  if (ver.isYanked) throw new RegistryError("Version not found or yanked", 404);

  const filename = archiveDownloadFilename(tmpl.name, ver.version);
  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: ver.archiveUrl,
      ResponseContentDisposition: `attachment; filename="${filename}"`,
    }),
    { expiresIn: 300 },
  );

  recordDownloadEvent({
    templateId: tmpl.id,
    versionId: ver.id,
    ipHash: hashIpAddress(ipAddress),
    userAgent,
    source: normalizeDownloadSource(source),
  }).catch((error) => {
    console.error("[downloads] failed to record download event:", error);
  });

  return {
    url,
    sha256: ver.archiveSha256,
    size: ver.archiveSize,
    filename,
  };
}

export async function getTemplateDownloadStats(
  templateName: string,
  period: DownloadStatsPeriod,
): Promise<{
  templateName: string;
  period: DownloadStatsPeriod;
  downloads: Array<{ date: string; count: number }>;
  total: number;
}> {
  const tmpl = await db.query.templates.findFirst({ where: eq(templates.name, templateName) });
  if (!tmpl) throw new RegistryError("Not found", 404);

  const periodDays = period === "day" ? 1 : period === "week" ? 7 : 30;
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      date: sql<string>`date_trunc('day', ${downloadEvents.downloadedAt})::date::text`,
      count: sql<number>`count(*)`,
    })
    .from(downloadEvents)
    .where(and(eq(downloadEvents.templateId, tmpl.id), gte(downloadEvents.downloadedAt, since)))
    .groupBy(sql`date_trunc('day', ${downloadEvents.downloadedAt})`)
    .orderBy(sql`date_trunc('day', ${downloadEvents.downloadedAt})`);

  const downloads = rows.map((row) => ({ date: row.date, count: Number(row.count) }));

  return {
    templateName,
    period,
    downloads,
    total: downloads.reduce((sum, row) => sum + row.count, 0),
  };
}

export function getWeekStart(date = new Date()): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function refreshWeeklyDownloads(): Promise<number> {
  const weekStart = getWeekStart();

  await db.execute(
    sql`UPDATE templates SET weekly_downloads = COALESCE(
      (SELECT COUNT(*)::int FROM download_events
       WHERE template_id = templates.id
       AND downloaded_at >= NOW() - INTERVAL '7 days'),
      0
    )`,
  );

  const counts = await db
    .select({
      templateId: downloadEvents.templateId,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(downloadEvents)
    .where(gte(downloadEvents.downloadedAt, weekStart))
    .groupBy(downloadEvents.templateId);

  const countMap = new Map(counts.map((row) => [row.templateId, row.count]));
  const allTemplates = await db.select({ id: templates.id }).from(templates);

  if (allTemplates.length === 0) return 0;

  await db
    .insert(weeklyDownloadSnapshots)
    .values(
      allTemplates.map(({ id }) => ({
        templateId: id,
        weekStart,
        downloadCount: countMap.get(id) ?? 0,
      })),
    )
    .onConflictDoUpdate({
      target: [weeklyDownloadSnapshots.templateId, weeklyDownloadSnapshots.weekStart],
      set: { downloadCount: sql`EXCLUDED.download_count` },
    });

  return allTemplates.length;
}
