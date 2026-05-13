export const TEMPLATE_SORTS = ["weekly_downloads", "downloads", "stars", "newest"] as const;
export type TemplateSort = (typeof TEMPLATE_SORTS)[number];

export const DOWNLOAD_SOURCES = ["cli", "web", "api", "citet"] as const;
export type DownloadSource = (typeof DOWNLOAD_SOURCES)[number];

export type DownloadStatsPeriod = "day" | "week" | "month";

export interface TemplateSearchParams {
  q?: string;
  category?: string;
  sort?: TemplateSort;
  page?: number;
  perPage?: number;
}

export function registryInfoPath(): string {
  return "/.well-known/loadclass";
}

export function categoriesPath(): string {
  return "/v1/categories";
}

export function listTemplatesPath(search: TemplateSearchParams = {}): string {
  const params = new URLSearchParams();
  if (search.q) params.set("q", search.q);
  if (search.category) params.set("category", search.category);
  if (search.sort) params.set("sort", search.sort);
  if (search.page != null) params.set("page", String(search.page));
  if (search.perPage != null) params.set("per_page", String(search.perPage));
  const query = params.toString();
  return query ? `/v1/templates?${query}` : "/v1/templates";
}

export function manageableTemplatesPath(): string {
  return "/v1/templates/mine";
}

export function publishTemplatePath(): string {
  return "/v1/templates";
}

export function templateDetailPath(templateName: string): string {
  return `/v1/templates/${encodePathSegment(templateName)}`;
}

export function templateThumbnailPath(templateName: string): string {
  return `${templateDetailPath(templateName)}/thumbnail`;
}

export function templateStarPath(templateName: string): string {
  return `${templateDetailPath(templateName)}/star`;
}

export function templateDeprecationPath(templateName: string): string {
  return `${templateDetailPath(templateName)}/deprecate`;
}

export function templateDistTagPath(templateName: string, tag: string): string {
  return `${templateDetailPath(templateName)}/dist-tags/${encodePathSegment(tag)}`;
}

export function templateVersionYankPath(templateName: string, version: string): string {
  return `${templateDetailPath(templateName)}/versions/${encodePathSegment(version)}/yank`;
}

export function templateVersionDownloadPath({
  templateName,
  version,
  source,
}: {
  templateName: string;
  version: string;
  source?: DownloadSource | string | null | undefined;
}): string {
  const query = source ? `?source=${encodeURIComponent(source)}` : "";
  return `${templateDetailPath(templateName)}/versions/${encodePathSegment(version)}/download${query}`;
}

export function templateDownloadStatsPath(
  templateName: string,
  period?: DownloadStatsPeriod,
): string {
  const query = period ? `?period=${encodeURIComponent(period)}` : "";
  return `${templateDetailPath(templateName)}/downloads${query}`;
}

export function userProfilePath(userId: string): string {
  return `/v1/users/${encodePathSegment(userId)}`;
}

export function organizationProfilePath(slug: string): string {
  return `/v1/orgs/${encodePathSegment(slug)}`;
}

export function adminTemplatesPath(): string {
  return "/v1/admin/templates";
}

export function adminOrganizationsPath(): string {
  return "/v1/admin/orgs";
}

export function adminTemplateVerificationPath(templateName: string): string {
  return `${adminTemplatesPath()}/${encodePathSegment(templateName)}/verify`;
}

export function adminOrganizationVerificationPath(slug: string): string {
  return `${adminOrganizationsPath()}/${encodePathSegment(slug)}/verify`;
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}
