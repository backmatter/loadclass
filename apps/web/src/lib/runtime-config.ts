import { createServerFn } from "@tanstack/react-start";
import { getRouteApi } from "@tanstack/react-router";

export interface RuntimePublicConfig {
  apiUrl: string;
  siteUrl: string;
  citetUrl: string;
  authProviders: string[];
  emailPasswordAuthEnabled: boolean;
}

export interface RuntimeRouteContext {
  runtimeConfig?: RuntimePublicConfig;
}

function processEnv(): Record<string, string | undefined> {
  return (
    (globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> };
    }).process?.env ?? {}
  );
}

function runtimeEnv(name: string): string | undefined {
  const env = processEnv();
  const value = env[name];
  return value != null && value !== "" ? value : undefined;
}

function requiredRuntimeEnv(name: string): string {
  const value = runtimeEnv(name);
  if (!value) {
    throw new Error(`${name} must be set for the Loadclass web runtime`);
  }
  return value;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function parseProviders(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((provider) => provider.trim().toLowerCase())
    .filter(Boolean);
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value === "") return fallback;
  return !["0", "false", "off", "no"].includes(value.trim().toLowerCase());
}

export function runtimePublicConfigFromEnv(): RuntimePublicConfig {
  return {
    apiUrl: trimTrailingSlash(requiredRuntimeEnv("LOADCLASS_PUBLIC_API_URL")),
    siteUrl: trimTrailingSlash(requiredRuntimeEnv("LOADCLASS_SITE_URL")),
    citetUrl: trimTrailingSlash(runtimeEnv("LOADCLASS_CITET_URL") ?? ""),
    authProviders: parseProviders(runtimeEnv("LOADCLASS_AUTH_PROVIDERS")),
    emailPasswordAuthEnabled: parseBoolean(
      requiredRuntimeEnv("LOADCLASS_EMAIL_PASSWORD_AUTH_ENABLED"),
      true,
    ),
  };
}

export const getRuntimePublicConfig = createServerFn({ method: "GET" }).handler(async () =>
  runtimePublicConfigFromEnv(),
);

export function runtimeConfigFromContext(context: RuntimeRouteContext): RuntimePublicConfig {
  if (!context.runtimeConfig) {
    throw new Error("Loadclass runtime config was not loaded");
  }
  return context.runtimeConfig;
}

export function internalApiUrl(): string {
  return trimTrailingSlash(requiredRuntimeEnv("LOADCLASS_INTERNAL_API_URL"));
}

export function requestApiUrl(config: Pick<RuntimePublicConfig, "apiUrl">): string {
  return typeof window === "undefined" ? internalApiUrl() : config.apiUrl;
}

export function publicAssetUrl(
  config: Pick<RuntimePublicConfig, "apiUrl">,
  path: string,
): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${config.apiUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

const rootRouteApi = getRouteApi("__root__");

export function useRuntimeConfig(): RuntimePublicConfig {
  const context = rootRouteApi.useRouteContext();
  return runtimeConfigFromContext(context);
}
