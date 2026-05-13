import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./auth-schema.ts";

// ─── Users (core table owned by Better Auth) ─────────────────────────────────

const cascadingUserId = () =>
  text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });

// ─── Enums ────────────────────────────────────────────────────────────────────

export const downloadSourceEnum = pgEnum("download_source", ["cli", "web", "api", "citet"]);

// ─── Templates ────────────────────────────────────────────────────────────────

export const templates = pgTable(
  "templates",
  {
    id: text("id").primaryKey(),
    // Scoped: "@acm/ieee-paper", unscoped: "thesis-template"
    name: text("name").notNull(),
    title: text("title").notNull(),
    // null for unscoped templates
    namespace: text("namespace"),
    description: text("description").notNull(),
    license: text("license").notNull(),
    homepage: text("homepage"),
    repository: text("repository"),
    sourceType: text("source_type").notNull().default("unknown"),
    sourceUrl: text("source_url"),
    publisher: text("publisher"),
    category: text("category").notNull(),
    readme: text("readme").notNull().default(""),
    thumbnailUrl: text("thumbnail_url"),
    // exactly one of these is set
    ownerUserId: text("owner_user_id").references(() => user.id),
    ownerOrgId: text("owner_org_id").references(() => organization.id),
    isVerified: boolean("is_verified").notNull().default(false),
    isDeprecated: boolean("is_deprecated").notNull().default(false),
    deprecationMessage: text("deprecation_message"),
    latestVersion: text("latest_version"),
    downloadCount: integer("download_count").notNull().default(0),
    weeklyDownloads: integer("weekly_downloads").notNull().default(0),
    starCount: integer("star_count").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("templates_name_idx").on(t.name),
    index("templates_namespace_idx").on(t.namespace),
    index("templates_category_idx").on(t.category),
    index("templates_weekly_downloads_idx").on(t.weeklyDownloads),
    check(
      "templates_exactly_one_owner_chk",
      sql`(owner_user_id IS NOT NULL AND owner_org_id IS NULL) OR (owner_user_id IS NULL AND owner_org_id IS NOT NULL)`,
    ),
  ],
);

export const templateMaintainers = pgTable(
  "template_maintainers",
  {
    templateId: text("template_id")
      .notNull()
      .references(() => templates.id, { onDelete: "cascade" }),
    userId: cascadingUserId(),
    addedAt: timestamp("added_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.templateId, t.userId] })],
);

// ─── Versions ─────────────────────────────────────────────────────────────────

export const templateVersions = pgTable(
  "template_versions",
  {
    id: text("id").primaryKey(),
    templateId: text("template_id")
      .notNull()
      .references(() => templates.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    description: text("description"),
    archiveUrl: text("archive_url").notNull(),
    archiveSize: integer("archive_size").notNull(),
    archiveSha256: text("archive_sha256").notNull(),
    manifest: jsonb("manifest").notNull(),
    publishedById: text("user_id")
      .notNull()
      .references(() => user.id),
    isYanked: boolean("is_yanked").notNull().default(false),
    yankedReason: text("yanked_reason"),
    downloadCount: integer("download_count").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("template_versions_tmpl_ver_uidx").on(t.templateId, t.version),
    index("template_versions_template_idx").on(t.templateId),
  ],
);

export const distTags = pgTable(
  "dist_tags",
  {
    templateId: text("template_id")
      .notNull()
      .references(() => templates.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
    version: text("version").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.templateId, t.tag] }),
    foreignKey({
      columns: [t.templateId, t.version],
      foreignColumns: [templateVersions.templateId, templateVersions.version],
      name: "dist_tags_template_version_fk",
    }).onDelete("cascade"),
  ],
);

// ─── Stars ────────────────────────────────────────────────────────────────────

export const stars = pgTable(
  "stars",
  {
    userId: cascadingUserId(),
    templateId: text("template_id")
      .notNull()
      .references(() => templates.id, { onDelete: "cascade" }),
    starredAt: timestamp("starred_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.templateId] })],
);

// ─── Downloads ────────────────────────────────────────────────────────────────

export const downloadEvents = pgTable(
  "download_events",
  {
    id: text("id").primaryKey(),
    templateId: text("template_id")
      .notNull()
      .references(() => templates.id, { onDelete: "cascade" }),
    versionId: text("version_id")
      .notNull()
      .references(() => templateVersions.id, { onDelete: "cascade" }),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    source: downloadSourceEnum("source"),
    downloadedAt: timestamp("downloaded_at").notNull().defaultNow(),
  },
  (t) => [
    index("download_events_template_idx").on(t.templateId),
    index("download_events_at_idx").on(t.downloadedAt),
  ],
);

// ─── Weekly download snapshots ────────────────────────────────────────────────

export const weeklyDownloadSnapshots = pgTable(
  "weekly_download_snapshots",
  {
    templateId: text("template_id")
      .notNull()
      .references(() => templates.id, { onDelete: "cascade" }),
    weekStart: timestamp("week_start").notNull(),
    downloadCount: integer("download_count").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.templateId, t.weekStart] }),
    index("weekly_snapshots_template_idx").on(t.templateId),
    index("weekly_snapshots_week_idx").on(t.weekStart),
  ],
);

// ─── Categories ───────────────────────────────────────────────────────────────

export const categories = pgTable("categories", {
  slug: text("slug").primaryKey(),
  label: text("label").notNull(),
  description: text("description"),
  displayOrder: integer("display_order").notNull().default(0),
});

// ─── Registry config ──────────────────────────────────────────────────────────

export const registryConfig = pgTable("registry_config", {
  id: integer("id").primaryKey().default(1),
  registryName: text("registry_name").notNull().default("loadclass"),
  registryUrl: text("registry_url").notNull(),
  allowRegistration: boolean("allow_registration").notNull().default(true),
  allowPublishing: boolean("allow_publishing").notNull().default(true),
  upstreamRegistries: text("upstream_registries").array().notNull().default([]),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── API rate limits ─────────────────────────────────────────────────────────

export const rateLimitFlexible = pgTable(
  "rate_limit_flexible",
  {
    key: varchar("key", { length: 255 }).primaryKey(),
    points: integer("points").notNull().default(0),
    expire: bigint("expire", { mode: "number" }),
  },
  (t) => [index("rate_limit_flexible_expire_idx").on(t.expire)],
);
