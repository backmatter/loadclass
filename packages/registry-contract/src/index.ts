import { z } from "zod";
export * from "./template-package.ts";
export * from "./operations.ts";

export const TemplateSummary = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string(),
  namespace: z.string().nullable(),
  description: z.string(),
  license: z.string(),
  homepage: z.string().nullable(),
  repository: z.string().nullable(),
  sourceType: z.string(),
  sourceUrl: z.string().nullable(),
  publisher: z.string().nullable(),
  category: z.string(),
  readme: z.string(),
  latestVersion: z.string().nullable(),
  ownerUserId: z.string().nullable(),
  ownerOrgId: z.string().nullable(),
  downloadCount: z.number(),
  weeklyDownloads: z.number(),
  starCount: z.number(),
  isVerified: z.boolean(),
  isTemplateVerified: z.boolean(),
  isOrgVerified: z.boolean(),
  isDeprecated: z.boolean(),
  deprecationMessage: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  isLocal: z.boolean(),
  upstreamRegistry: z.string().url().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const VersionSummary = z.object({
  id: z.string(),
  templateId: z.string(),
  version: z.string(),
  description: z.string().nullable(),
  archiveUrl: z.string(),
  archiveSize: z.number(),
  archiveSha256: z.string(),
  manifest: z.unknown(),
  publishedById: z.string(),
  isYanked: z.boolean(),
  yankedReason: z.string().nullable(),
  downloadCount: z.number(),
  createdAt: z.string(),
});

export const UserOwnerInfo = z.object({
  type: z.literal("user"),
  id: z.string(),
  name: z.string(),
  image: z.string().nullable(),
});

export const OrganizationOwnerInfo = z.object({
  type: z.literal("org"),
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  logo: z.string().nullable(),
  isVerified: z.boolean(),
});

export const OwnerInfo = z.discriminatedUnion("type", [UserOwnerInfo, OrganizationOwnerInfo]);

export const TemplateDetail = TemplateSummary.extend({
  owner: OwnerInfo.nullable(),
  isStarred: z.boolean(),
  canManage: z.boolean(),
  versions: z.array(VersionSummary),
  distTags: z.record(z.string()),
});

export const ListTemplatesResponse = z.object({
  templates: z.array(TemplateSummary),
  total: z.number(),
  page: z.number(),
  perPage: z.number(),
});

export const PublishQualityIssue = z.object({
  code: z.string(),
  message: z.string(),
  detail: z.string().optional(),
});

export const PublishResponse = z.object({
  name: z.string(),
  version: z.string(),
  archiveKey: z.string(),
});

export const DistTagResponse = z.object({
  tag: z.string(),
  version: z.string(),
});

export const DownloadUrlResponse = z.object({
  url: z.string().url(),
  sha256: z.string(),
  size: z.number(),
  filename: z.string(),
});

export const DownloadStatsResponse = z.object({
  templateName: z.string(),
  period: z.enum(["day", "week", "month"]),
  downloads: z.array(z.object({ date: z.string(), count: z.number() })),
  total: z.number(),
});

export const Category = z.object({
  slug: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  templateCount: z.number(),
});

export const UserProfile = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  createdAt: z.string(),
  templates: z.array(TemplateSummary),
});

export const OrganizationMember = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  role: z.string(),
});

export const OrganizationProfile = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  logo: z.string().nullable(),
  isVerified: z.boolean(),
  createdAt: z.string(),
  templates: z.array(TemplateSummary),
  members: z.array(OrganizationMember),
});

export const AdminTemplatesResponse = z.object({
  templates: z.array(TemplateSummary),
});

export const AdminOrganization = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  logo: z.string().nullable(),
  createdAt: z.string(),
  metadata: z.string().nullable(),
  isVerified: z.boolean(),
  verifiedAt: z.string().nullable(),
});

export const AdminOrganizationsResponse = z.object({
  orgs: z.array(AdminOrganization),
});

export const OrganizationVerificationResponse = z.object({
  slug: z.string(),
  isVerified: z.boolean(),
});

export const TemplateVerificationResponse = z.object({
  name: z.string(),
  isVerified: z.boolean(),
});

export const RegistryInfo = z.object({
  name: z.string(),
  url: z.string(),
  version: z.literal("1"),
  allowRegistration: z.boolean(),
  allowPublishing: z.boolean(),
  upstreamRegistries: z.array(z.string().url()),
});

export const ErrorResponse = z.object({
  error: z.string(),
  code: z.string().optional(),
  detail: z.string().optional(),
});

export type TemplateSummary = z.infer<typeof TemplateSummary>;
export type VersionSummary = z.infer<typeof VersionSummary>;
export type UserOwnerInfo = z.infer<typeof UserOwnerInfo>;
export type OrganizationOwnerInfo = z.infer<typeof OrganizationOwnerInfo>;
export type OwnerInfo = z.infer<typeof OwnerInfo>;
export type TemplateDetail = z.infer<typeof TemplateDetail>;
export type ListTemplatesResponse = z.infer<typeof ListTemplatesResponse>;
export type PublishResponse = z.infer<typeof PublishResponse>;
export type PublishQualityIssue = z.infer<typeof PublishQualityIssue>;
export type DistTagResponse = z.infer<typeof DistTagResponse>;
export type DownloadUrlResponse = z.infer<typeof DownloadUrlResponse>;
export type DownloadStatsResponse = z.infer<typeof DownloadStatsResponse>;
export type Category = z.infer<typeof Category>;
export type UserProfile = z.infer<typeof UserProfile>;
export type OrganizationMember = z.infer<typeof OrganizationMember>;
export type OrganizationProfile = z.infer<typeof OrganizationProfile>;
export type AdminTemplatesResponse = z.infer<typeof AdminTemplatesResponse>;
export type AdminOrganization = z.infer<typeof AdminOrganization>;
export type AdminOrganizationsResponse = z.infer<typeof AdminOrganizationsResponse>;
export type OrganizationVerificationResponse = z.infer<typeof OrganizationVerificationResponse>;
export type TemplateVerificationResponse = z.infer<typeof TemplateVerificationResponse>;
export type RegistryInfo = z.infer<typeof RegistryInfo>;
export type ErrorResponse = z.infer<typeof ErrorResponse>;
