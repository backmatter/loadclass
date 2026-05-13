import "zod-openapi/extend";
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
  .openapi({ ref: "TemplateNameParam" });

export const VersionParam = z
  .object({
    version: z.string().describe("Semver version string"),
  })
  .openapi({ ref: "VersionParam" });

export const PaginationQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    per_page: z.coerce.number().int().min(1).max(100).default(20),
  })
  .openapi({ ref: "PaginationQuery" });

// Registry contract shapes

export const TemplateSummary = ContractTemplateSummary.openapi({ ref: "TemplateSummary" });
export const VersionSummary = ContractVersionSummary.openapi({ ref: "VersionSummary" });
export const OwnerInfo = ContractOwnerInfo.openapi({ ref: "OwnerInfo" });
export const TemplateDetail = ContractTemplateDetail.openapi({ ref: "TemplateDetail" });
export const ListTemplatesResponse = ContractListTemplatesResponse.openapi({
  ref: "ListTemplatesResponse",
});
export const TemplateManifest = ContractTemplateManifest.openapi({ ref: "TemplateManifest" });
export const PublishResponse = ContractPublishResponse.openapi({ ref: "PublishResponse" });
export const DistTagResponse = ContractDistTagResponse.openapi({ ref: "DistTagResponse" });
export const DownloadUrlResponse = ContractDownloadUrlResponse.openapi({ ref: "DownloadUrlResponse" });
export const DownloadStatsResponse = ContractDownloadStatsResponse.openapi({
  ref: "DownloadStatsResponse",
});
export const Category = ContractCategory.openapi({ ref: "Category" });
export const UserProfile = ContractUserProfile.openapi({ ref: "UserProfile" });
export const OrganizationMember = ContractOrganizationMember.openapi({ ref: "OrganizationMember" });
export const OrganizationProfile = ContractOrganizationProfile.openapi({
  ref: "OrganizationProfile",
});
export const AdminTemplatesResponse = ContractAdminTemplatesResponse.openapi({
  ref: "AdminTemplatesResponse",
});
export const AdminOrganization = ContractAdminOrganization.openapi({ ref: "AdminOrganization" });
export const AdminOrganizationsResponse = ContractAdminOrganizationsResponse.openapi({
  ref: "AdminOrganizationsResponse",
});
export const OrganizationVerificationResponse = ContractOrganizationVerificationResponse.openapi({
  ref: "OrganizationVerificationResponse",
});
export const TemplateVerificationResponse = ContractTemplateVerificationResponse.openapi({
  ref: "TemplateVerificationResponse",
});
export const RegistryInfo = ContractRegistryInfo.openapi({ ref: "RegistryInfo" });
export const ErrorResponse = ContractErrorResponse.openapi({ ref: "ErrorResponse" });

// Request/query shapes

export const ListTemplatesQuery = PaginationQuery.extend({
  q: z.string().optional().describe("Full-text search query"),
  category: z.string().optional(),
  sort: z.enum(TEMPLATE_SORTS).default("downloads"),
}).openapi({ ref: "ListTemplatesQuery" });

export const DistTagBody = z
  .object({
    version: z.string(),
  })
  .openapi({ ref: "DistTagBody" });

export const YankBody = z
  .object({
    reason: z.string().optional(),
  })
  .openapi({ ref: "YankBody" });

export const DeprecateBody = z
  .object({
    message: z.string().optional(),
  })
  .openapi({ ref: "DeprecateBody" });

export const DownloadStatsQuery = z
  .object({
    period: z.enum(["day", "week", "month"]).default("week"),
  })
  .openapi({ ref: "DownloadStatsQuery" });
