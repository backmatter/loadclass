import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import {
  adminOrganizationVerificationPath,
  adminOrganizationsPath,
  adminTemplateVerificationPath,
  adminTemplatesPath,
  categoriesPath,
  listTemplatesPath,
  manageableTemplatesPath,
  organizationProfilePath,
  publishTemplatePath,
  templateDeprecationPath,
  templateDetailPath,
  templateDistTagPath,
  templateStarPath,
  templateVersionYankPath,
  userProfilePath,
  type TemplateSort,
  AdminOrganizationsResponse,
  AdminTemplatesResponse,
  Category,
  ListTemplatesResponse,
  OrganizationMember,
  OrganizationProfile,
  OwnerInfo,
  PublishResponse,
  TemplateDetail,
  TemplateManifest,
  TemplateSummary,
  UserProfile,
  VersionSummary,
} from "@loadclass/registry-contract";
import type { LoadclassAuthClient } from "./auth-client";
import type { OpenAPISpec } from "./openapi-types";
import {
  publicAssetUrl,
  requestApiUrl,
  type RuntimePublicConfig,
} from "./runtime-config";

export const PER_PAGE = 24;

export interface TemplateSearch {
  q?: string;
  category?: string;
  sort: TemplateSort;
}

export type TemplatesPage = ListTemplatesResponse;
export type TemplateVersion = VersionSummary;
export type TemplateOwner = OwnerInfo;
export type AdminOrgsResponse = AdminOrganizationsResponse;
export type {
  AdminTemplatesResponse,
  Category,
  OrganizationMember,
  OrganizationProfile,
  TemplateDetail,
  TemplateSummary,
  UserProfile,
};

export interface AuthOrganization {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  isVerified?: boolean;
}

export interface AuthOrganizationMember {
  id: string;
  userId?: string;
  role: string;
  user?: {
    name?: string | null;
  };
}

export interface FullAuthOrganization extends AuthOrganization {
  members?: AuthOrganizationMember[];
}

export interface ApiKey {
  id: string;
  name?: string | null;
  start?: string | null;
  prefix?: string | null;
  createdAt: string | Date;
  lastUsedAt?: string | Date | null;
}

interface ApiErrorPayload {
  message: string;
  code?: string;
  detail?: string;
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly detail?: string;

  constructor({
    message,
    status,
    code,
    detail,
  }: ApiErrorPayload & {
    status: number;
  }) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

async function errorPayload(response: Response): Promise<ApiErrorPayload> {
  const body = await response
    .clone()
    .json()
    .catch(() => null);

  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
    return {
      message: body.error,
      code: "code" in body && typeof body.code === "string" ? body.code : undefined,
      detail: "detail" in body && typeof body.detail === "string" ? body.detail : undefined,
    };
  }

  const text = await response.text().catch(() => "");
  return { message: text || `Request failed with ${response.status}` };
}

export async function apiFetch<T>(
  config: Pick<RuntimePublicConfig, "apiUrl">,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${requestApiUrl(config)}${path}`, {
    ...init,
    headers: new Headers(init.headers),
    credentials: init.credentials ?? "include",
  });

  if (!response.ok) {
    throw new ApiRequestError({
      status: response.status,
      ...(await errorPayload(response)),
    });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function normalizeTemplateSummary(
  config: Pick<RuntimePublicConfig, "apiUrl">,
  template: TemplateSummary,
): TemplateSummary {
  return {
    ...template,
    thumbnailUrl: template.thumbnailUrl ? publicAssetUrl(config, template.thumbnailUrl) : null,
  };
}

function normalizeTemplatesPage(
  config: Pick<RuntimePublicConfig, "apiUrl">,
  page: TemplatesPage,
): TemplatesPage {
  return {
    ...page,
    templates: page.templates.map((template) => normalizeTemplateSummary(config, template)),
  };
}

function normalizeTemplateDetail(
  config: Pick<RuntimePublicConfig, "apiUrl">,
  template: TemplateDetail,
): TemplateDetail {
  return normalizeTemplateSummary(config, template) as TemplateDetail;
}

export function templatesInfiniteQuery(
  config: Pick<RuntimePublicConfig, "apiUrl">,
  search: TemplateSearch,
) {
  return infiniteQueryOptions({
    queryKey: ["templates", "list", config.apiUrl, search],
    queryFn: ({ pageParam }) =>
      apiFetch<TemplatesPage>(
        config,
        listTemplatesPath({ ...search, page: pageParam, perPage: PER_PAGE }),
      ).then((page) => normalizeTemplatesPage(config, page)),
    initialPageParam: 1,
    staleTime: 30 * 1000,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      const loaded = lastPageParam * lastPage.perPage;
      return loaded < lastPage.total ? lastPageParam + 1 : undefined;
    },
  });
}

export function categoriesQuery(config: Pick<RuntimePublicConfig, "apiUrl">) {
  return queryOptions({
    queryKey: ["categories", config.apiUrl],
    queryFn: () => apiFetch<Category[]>(config, categoriesPath()),
    staleTime: 5 * 60 * 1000,
  });
}

export function templateDetailQuery(
  config: Pick<RuntimePublicConfig, "apiUrl">,
  name: string,
) {
  return queryOptions({
    queryKey: ["templates", "detail", config.apiUrl, name],
    queryFn: () =>
      apiFetch<TemplateDetail>(config, templateDetailPath(name)).then((template) =>
        normalizeTemplateDetail(config, template),
      ),
  });
}

export function userProfileQuery(config: Pick<RuntimePublicConfig, "apiUrl">, id: string) {
  return queryOptions({
    queryKey: ["users", config.apiUrl, id],
    queryFn: async () => {
      const profile = await apiFetch<UserProfile>(config, userProfilePath(id));
      return {
        ...profile,
        templates: profile.templates.map((template) => normalizeTemplateSummary(config, template)),
      };
    },
  });
}

export function organizationProfileQuery(
  config: Pick<RuntimePublicConfig, "apiUrl">,
  slug: string,
) {
  return queryOptions({
    queryKey: ["orgs", config.apiUrl, slug],
    queryFn: async () => {
      const org = await apiFetch<OrganizationProfile>(config, organizationProfilePath(slug));
      return {
        ...org,
        templates: org.templates.map((template) => normalizeTemplateSummary(config, template)),
      };
    },
  });
}

export function adminTemplatesQuery(config: Pick<RuntimePublicConfig, "apiUrl">) {
  return queryOptions({
    queryKey: ["admin", "templates", config.apiUrl],
    queryFn: () => apiFetch<AdminTemplatesResponse>(config, adminTemplatesPath()),
  });
}

export function adminOrgsQuery(config: Pick<RuntimePublicConfig, "apiUrl">) {
  return queryOptions({
    queryKey: ["admin", "orgs", config.apiUrl],
    queryFn: () => apiFetch<AdminOrgsResponse>(config, adminOrganizationsPath()),
  });
}

export function myTemplatesQuery(config: Pick<RuntimePublicConfig, "apiUrl">) {
  return queryOptions({
    queryKey: ["account", "templates", config.apiUrl],
    queryFn: () =>
      apiFetch<TemplatesPage>(config, manageableTemplatesPath()).then((page) =>
        normalizeTemplatesPage(config, page),
      ),
  });
}

export function sessionQuery(authClient: LoadclassAuthClient) {
  return queryOptions({
    queryKey: ["auth", "session"],
    queryFn: async () => {
      const { data, error } = await authClient.getSession();
      if (error) return null;
      return data;
    },
    staleTime: 30 * 1000,
  });
}

export function apiKeysQuery(authClient: LoadclassAuthClient) {
  return queryOptions({
    queryKey: ["auth", "api-keys"],
    queryFn: async () => {
      const { data, error } = await authClient.apiKey.list();
      if (error) throw new Error(error.message ?? "Failed to load API keys");
      if (Array.isArray(data)) return data as ApiKey[];
      return ((data as { apiKeys?: unknown[] } | null)?.apiKeys ?? []) as ApiKey[];
    },
  });
}

export function organizationsQuery(authClient: LoadclassAuthClient) {
  return queryOptions({
    queryKey: ["auth", "organizations"],
    queryFn: async () => {
      const { data, error } = await authClient.organization.list();
      if (error) throw new Error(error.message ?? "Failed to load organizations");
      return (data ?? []) as AuthOrganization[];
    },
  });
}

export function fullOrganizationQuery(
  authClient: LoadclassAuthClient,
  organizationId: string,
) {
  return queryOptions({
    queryKey: ["auth", "organizations", organizationId],
    queryFn: async () => {
      const { data, error } = await authClient.organization.getFullOrganization({
        query: { organizationId },
      });
      if (error) throw new Error(error.message ?? "Failed to load organization");
      return data as FullAuthOrganization;
    },
  });
}

export function openApiSpecQuery(config: Pick<RuntimePublicConfig, "apiUrl">) {
  return queryOptions({
    queryKey: ["openapi", config.apiUrl],
    queryFn: () => apiFetch<OpenAPISpec>(config, "/openapi.json"),
  });
}

export function publishTemplatePackage(
  config: Pick<RuntimePublicConfig, "apiUrl">,
  file: File,
  manifest: TemplateManifest,
): Promise<PublishResponse> {
  const body = new FormData();
  body.append("manifest", JSON.stringify(manifest));
  body.append("archive", file);

  return apiFetch<PublishResponse>(config, publishTemplatePath(), {
    method: "POST",
    body,
  });
}

// Template stewardship mutations

export function starTemplate(
  config: Pick<RuntimePublicConfig, "apiUrl">,
  name: string,
): Promise<void> {
  return apiFetch<void>(config, templateStarPath(name), { method: "POST" });
}

export function unstarTemplate(
  config: Pick<RuntimePublicConfig, "apiUrl">,
  name: string,
): Promise<void> {
  return apiFetch<void>(config, templateStarPath(name), { method: "DELETE" });
}

export function deprecateTemplate(
  config: Pick<RuntimePublicConfig, "apiUrl">,
  { name, message }: { name: string; message?: string },
): Promise<void> {
  return apiFetch<void>(config, templateDeprecationPath(name), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: message || undefined }),
  });
}

export function restoreDeprecatedTemplate(
  config: Pick<RuntimePublicConfig, "apiUrl">,
  name: string,
): Promise<void> {
  return apiFetch<void>(config, templateDeprecationPath(name), { method: "DELETE" });
}

export function setDistTag(
  config: Pick<RuntimePublicConfig, "apiUrl">,
  { name, tag, version }: { name: string; tag: string; version: string },
): Promise<void> {
  return apiFetch<void>(config, templateDistTagPath(name, tag), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version }),
  });
}

export function deleteDistTag(
  config: Pick<RuntimePublicConfig, "apiUrl">,
  { name, tag }: { name: string; tag: string },
): Promise<void> {
  return apiFetch<void>(config, templateDistTagPath(name, tag), { method: "DELETE" });
}

export function yankTemplateVersion(
  config: Pick<RuntimePublicConfig, "apiUrl">,
  { name, version, reason }: { name: string; version: string; reason?: string },
): Promise<void> {
  return apiFetch<void>(config, templateVersionYankPath(name, version), {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reason !== undefined ? { reason } : {}),
  });
}

// Admin template actions

export function setTemplateVerification(
  config: Pick<RuntimePublicConfig, "apiUrl">,
  name: string,
): Promise<void> {
  return apiFetch<void>(config, adminTemplateVerificationPath(name), { method: "POST" });
}

export function removeTemplateVerification(
  config: Pick<RuntimePublicConfig, "apiUrl">,
  name: string,
): Promise<void> {
  return apiFetch<void>(config, adminTemplateVerificationPath(name), { method: "DELETE" });
}

// Organization actions

export function setOrganizationVerification(
  config: Pick<RuntimePublicConfig, "apiUrl">,
  slug: string,
): Promise<void> {
  return apiFetch<void>(config, adminOrganizationVerificationPath(slug), { method: "POST" });
}

export function removeOrganizationVerification(
  config: Pick<RuntimePublicConfig, "apiUrl">,
  slug: string,
): Promise<void> {
  return apiFetch<void>(config, adminOrganizationVerificationPath(slug), { method: "DELETE" });
}
