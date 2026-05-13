import { createHash } from "node:crypto";
import type { PublishQualityIssue, TemplateManifest } from "@loadclass/registry-contract";

export interface GeneratedTemplateThumbnail {
  thumbnailKey: string;
  thumbnailBuffer: Buffer;
  contentType: string;
  sha256: string;
}

export interface GenerateTemplateThumbnailInput {
  manifest: TemplateManifest;
  archiveBuffer: Buffer;
  skipIfManifestThumbnail?: boolean;
}

export interface GenerateTemplateThumbnailReport {
  status: "generated" | "failed" | "skipped";
  thumbnail: GeneratedTemplateThumbnail | null;
  issue: PublishQualityIssue | null;
}

const DEFAULT_PREVIEW_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_THUMBNAIL_BYTES = 3 * 1024 * 1024;

function previewWorkerUrl(): string | null {
  const value = process.env.TEMPLATE_PREVIEW_WORKER_URL?.trim();
  return value ? value.replace(/\/$/, "") : null;
}

function previewTimeoutMs(): number {
  const configured = Number.parseInt(process.env.TEMPLATE_PREVIEW_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_PREVIEW_TIMEOUT_MS;
}

function maxThumbnailBytes(): number {
  const configured = Number.parseInt(process.env.MAX_THUMBNAIL_BYTES ?? "", 10);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_THUMBNAIL_BYTES;
}

function thumbnailKey(manifest: TemplateManifest): string {
  return `thumbnails/${manifest.name}/${manifest.version}.png`;
}

function previewIssue(code: string, message: string, detail?: string): PublishQualityIssue {
  return detail ? { code, message, detail } : { code, message };
}

async function previewIssueFromResponse(response: Response): Promise<PublishQualityIssue> {
  const body: unknown = await response.json().catch(() => null);

  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    const code = typeof record.code === "string" ? record.code : "thumbnail_generation_failed";
    const message =
      typeof record.error === "string"
        ? record.error
        : "The template did not compile in the preview sandbox.";
    const detail = typeof record.detail === "string" ? record.detail : undefined;
    return previewIssue(code, message, detail);
  }

  return previewIssue(
    "thumbnail_generation_failed",
    "The template did not compile in the preview sandbox.",
  );
}

export async function generateTemplateThumbnailReport({
  manifest,
  archiveBuffer,
  skipIfManifestThumbnail = true,
}: GenerateTemplateThumbnailInput): Promise<GenerateTemplateThumbnailReport> {
  if (skipIfManifestThumbnail && manifest.thumbnailUrl) {
    return {
      status: "skipped",
      thumbnail: null,
      issue: previewIssue(
        "manual_thumbnail_url",
        "Generated thumbnail skipped because the manifest already provides a thumbnail URL.",
      ),
    };
  }

  const baseUrl = previewWorkerUrl();
  if (!baseUrl) {
    return {
      status: "skipped",
      thumbnail: null,
      issue: previewIssue(
        "preview_worker_not_configured",
        "Generated thumbnail skipped because the preview worker is not configured.",
      ),
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), previewTimeoutMs());

  try {
    const headers = new Headers({ "content-type": "application/json" });
    const token = process.env.PREVIEW_WORKER_TOKEN?.trim();
    if (token) headers.set("authorization", `Bearer ${token}`);

    const response = await fetch(`${baseUrl}/render`, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        manifest,
        archiveBase64: archiveBuffer.toString("base64"),
      }),
    });

    if (!response.ok) {
      const issue = await previewIssueFromResponse(response);
      console.warn(
        `[template-preview] thumbnail generation failed for ${manifest.name}@${manifest.version}: ${response.status} ${issue.code} ${issue.message}`,
      );
      return { status: "failed", thumbnail: null, issue };
    }

    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (contentType !== "image/png") {
      console.warn(
        `[template-preview] thumbnail worker returned unsupported content type for ${manifest.name}@${manifest.version}: ${contentType}`,
      );
      return {
        status: "failed",
        thumbnail: null,
        issue: previewIssue(
          "thumbnail_response_invalid",
          "The preview worker returned an invalid thumbnail response.",
        ),
      };
    }

    const thumbnailBuffer = Buffer.from(await response.arrayBuffer());
    if (thumbnailBuffer.byteLength === 0 || thumbnailBuffer.byteLength > maxThumbnailBytes()) {
      console.warn(
        `[template-preview] thumbnail size rejected for ${manifest.name}@${manifest.version}: ${thumbnailBuffer.byteLength} bytes`,
      );
      return {
        status: "failed",
        thumbnail: null,
        issue: previewIssue(
          "thumbnail_size_rejected",
          "The generated thumbnail was empty or too large.",
        ),
      };
    }

    return {
      status: "generated",
      issue: null,
      thumbnail: {
        thumbnailKey: thumbnailKey(manifest),
        thumbnailBuffer,
        contentType,
        sha256: createHash("sha256").update(thumbnailBuffer).digest("hex"),
      },
    };
  } catch (error) {
    console.warn(
      `[template-preview] thumbnail generation failed for ${manifest.name}@${manifest.version}:`,
      error,
    );
    return {
      status: "failed",
      thumbnail: null,
      issue: previewIssue(
        error instanceof DOMException && error.name === "AbortError"
          ? "preview_worker_timeout"
          : "preview_worker_unavailable",
        error instanceof DOMException && error.name === "AbortError"
          ? "The preview worker timed out while building the thumbnail."
          : "The preview worker could not be reached.",
      ),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateTemplateThumbnail(
  input: GenerateTemplateThumbnailInput,
): Promise<GeneratedTemplateThumbnail | null> {
  const report = await generateTemplateThumbnailReport(input);
  return report.thumbnail;
}
