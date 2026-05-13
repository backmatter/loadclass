import { templateDetailPath, templateVersionDownloadPath } from "@loadclass/registry-contract";
import type { z } from "zod";
import { TemplateDetail, DownloadUrlResponse } from "../schemas.ts";
import { getRegistrySettings } from "./config.ts";

type TemplateDetailResponse = z.infer<typeof TemplateDetail>;
type DownloadUrl = z.infer<typeof DownloadUrlResponse>;

async function fetchJson<T>(
  upstream: string,
  path: string,
  schema: z.ZodType<T>,
): Promise<T | null> {
  const timeoutMs = Number.parseInt(process.env.UPSTREAM_REQUEST_TIMEOUT_MS ?? "3000", 10);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${upstream}${path}`, { signal: controller.signal });
    if (!response.ok) return null;
    const parsed = schema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchUpstreamTemplateDetail(
  templateName: string,
): Promise<TemplateDetailResponse | null> {
  const settings = await getRegistrySettings();

  for (const upstream of settings.upstreamRegistries) {
    const detail = await fetchJson(
      upstream,
      templateDetailPath(templateName),
      TemplateDetail,
    );
    if (detail) {
      return {
        ...detail,
        isLocal: false,
        upstreamRegistry: upstream,
        canManage: false,
        isStarred: false,
      };
    }
  }

  return null;
}

export async function fetchUpstreamDownloadUrl({
  templateName,
  version,
  source,
}: {
  templateName: string;
  version: string;
  source: string | null | undefined;
}): Promise<DownloadUrl | null> {
  const settings = await getRegistrySettings();

  for (const upstream of settings.upstreamRegistries) {
    const download = await fetchJson(
      upstream,
      templateVersionDownloadPath({ templateName, version, source }),
      DownloadUrlResponse,
    );
    if (download) return download;
  }

  return null;
}
