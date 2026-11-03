import {
  AdminOrganization as ContractAdminOrganization,
  AdminOrganizationsResponse as ContractAdminOrganizationsResponse,
  AdminTemplatesResponse as ContractAdminTemplatesResponse,
  Category as ContractCategory,
  DistTagResponse as ContractDistTagResponse,
  DownloadStatsResponse as ContractDownloadStatsResponse,
  DownloadUrlResponse as ContractDownloadUrlResponse,
  ErrorResponse as ContractErrorResponse,
  ListTemplatesResponse as ContractListTemplatesResponse,
  OrganizationMember as ContractOrganizationMember,
  OrganizationProfile as ContractOrganizationProfile,
  OrganizationVerificationResponse as ContractOrganizationVerificationResponse,
  OwnerInfo as ContractOwnerInfo,
  PublishResponse as ContractPublishResponse,
  RegistryInfo as ContractRegistryInfo,
  TEMPLATE_SORTS,
  TemplateDetail as ContractTemplateDetail,
  TemplateManifest as ContractTemplateManifest,
  TemplateSummary as ContractTemplateSummary,
  TemplateVerificationResponse as ContractTemplateVerificationResponse,
  UserProfile as ContractUserProfile,
  VersionSummary as ContractVersionSummary,
} from "@loadclass/registry-contract";
import { z } from "zod";

// Shared primitives

export const TemplateNameParam = z
  .object({
    name: z.string().describe("Template name, e.g. thesis-template or @acm/ieee-paper"),
  })
  .meta({ id: "TemplateNameParam" });

export const VersionParam = z
  .object({
    version: z.string().describe("Semver version string"),
  })
  .meta({ id: "VersionParam" });

export const PaginationQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    per_page: z.coerce.number().int().min(1).max(100).default(20),
  })
  .meta({ id: "PaginationQuery" });

// Registry contract shapes

export const TemplateSummary = ContractTemplateSummary.meta({ id: "TemplateSummary" });
export const VersionSummary = ContractVersionSummary.meta({ id: "VersionSummary" });
export const OwnerInfo = ContractOwnerInfo.meta({ id: "OwnerInfo" });
export const TemplateDetail = ContractTemplateDetail.meta({ id: "TemplateDetail" });
export const ListTemplatesResponse = ContractListTemplatesResponse.meta({
  id: "ListTemplatesResponse",
});
export const TemplateManifest = ContractTemplateManifest.meta({ id: "TemplateManifest" });
export const PublishResponse = ContractPublishResponse.meta({ id: "PublishResponse" });
export const DistTagResponse = ContractDistTagResponse.meta({ id: "DistTagResponse" });
export const DownloadUrlResponse = ContractDownloadUrlResponse.meta({ id: "DownloadUrlResponse" });
export const DownloadStatsResponse = ContractDownloadStatsResponse.meta({
  id: "DownloadStatsResponse",
});
export const Category = ContractCategory.meta({ id: "Category" });
export const UserProfile = ContractUserProfile.meta({ id: "UserProfile" });
export const OrganizationMember = ContractOrganizationMember.meta({ id: "OrganizationMember" });
export const OrganizationProfile = ContractOrganizationProfile.meta({ id: "OrganizationProfile" });
export const AdminTemplatesResponse = ContractAdminTemplatesResponse.meta({
  id: "AdminTemplatesResponse",
});
export const AdminOrganization = ContractAdminOrganization.meta({ id: "AdminOrganization" });
export const AdminOrganizationsResponse = ContractAdminOrganizationsResponse.meta({
  id: "AdminOrganizationsResponse",
});
export const OrganizationVerificationResponse = ContractOrganizationVerificationResponse.meta({
  id: "OrganizationVerificationResponse",
});
export const TemplateVerificationResponse = ContractTemplateVerificationResponse.meta({
  id: "TemplateVerificationResponse",
});
export const RegistryInfo = ContractRegistryInfo.meta({ id: "RegistryInfo" });
export const ErrorResponse = ContractErrorResponse.meta({ id: "ErrorResponse" });

// Request/query shapes

export const ListTemplatesQuery = PaginationQuery.extend({
  q: z.string().optional().describe("Full-text search query"),
  category: z.string().optional(),
  sort: z.enum(TEMPLATE_SORTS).default("downloads"),
}).meta({ id: "ListTemplatesQuery" });

export const DistTagBody = z
  .object({
    version: z.string(),
  })
  .meta({ id: "DistTagBody" });

export const YankBody = z
  .object({
    reason: z.string().optional(),
  })
  .meta({ id: "YankBody" });

export const DeprecateBody = z
  .object({
    message: z.string().optional(),
  })
  .meta({ id: "DeprecateBody" });

export const DownloadStatsQuery = z
  .object({
    period: z.enum(["day", "week", "month"]).default("week"),
  })
  .meta({ id: "DownloadStatsQuery" });
