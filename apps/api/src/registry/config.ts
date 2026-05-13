import { db, registryConfig } from "@loadclass/db";
import { eq } from "drizzle-orm";

export interface RegistrySettings {
  name: string;
  url: string;
  allowRegistration: boolean;
  allowPublishing: boolean;
  upstreamRegistries: string[];
}

function envFlag(name: string): boolean | null {
  const value = process.env[name];
  if (value == null) return null;
  return value !== "false";
}

function envList(name: string): string[] | null {
  const value = process.env[name];
  if (!value) return null;
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeRegistryUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export async function getRegistrySettings(): Promise<RegistrySettings> {
  const row = await db.query.registryConfig.findFirst({
    where: eq(registryConfig.id, 1),
  });

  const registryUrl = normalizeRegistryUrl(
    process.env.LOADCLASS_PUBLIC_API_URL ?? row?.registryUrl ?? "http://localhost:8080",
  );
  const envUpstreams = envList("UPSTREAM_REGISTRIES");
  const upstreamRegistries = (envUpstreams ?? row?.upstreamRegistries ?? [])
    .map(normalizeRegistryUrl)
    .filter((url, index, urls) => url !== registryUrl && urls.indexOf(url) === index);

  return {
    name: process.env.REGISTRY_NAME ?? row?.registryName ?? "loadclass",
    url: registryUrl,
    allowRegistration: envFlag("ALLOW_REGISTRATION") ?? row?.allowRegistration ?? true,
    allowPublishing: envFlag("ALLOW_PUBLISHING") ?? row?.allowPublishing ?? true,
    upstreamRegistries,
  };
}

export async function isRegistrationAllowed(): Promise<boolean> {
  return (await getRegistrySettings()).allowRegistration;
}

export async function isPublishingAllowed(): Promise<boolean> {
  return (await getRegistrySettings()).allowPublishing;
}
