import {
  DEFAULT_MAX_ARCHIVE_BYTES,
  isTemplateArchiveFilename,
  parseTemplateManifestSource,
  readTemplateTarEntries,
  validateTemplatePackageContents,
  type TemplateManifest as TemplateManifestInput,
} from "@loadclass/registry-contract";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { RegistryError } from "./errors.ts";

export interface TemplatePackageInput {
  manifestRaw: FormDataEntryValue | null;
  archive: FormDataEntryValue | null;
}

export interface PreparedTemplatePackage {
  manifest: TemplateManifestInput;
  archiveBuffer: Buffer;
  archiveKey: string;
  sha256: string;
}

function maxArchiveBytes(): number {
  const configured = Number.parseInt(process.env.MAX_ARCHIVE_BYTES ?? "", 10);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_ARCHIVE_BYTES;
}

async function parseManifest(raw: FormDataEntryValue | null): Promise<TemplateManifestInput> {
  if (raw == null) {
    throw new RegistryError("manifest (JSON string) and archive (file) are required", 400);
  }

  const manifestSource = typeof raw === "string" ? raw : await raw.text();

  try {
    return parseTemplateManifestSource(manifestSource);
  } catch (error) {
    throw new RegistryError(error instanceof Error ? error.message : String(error), 400);
  }
}

function parseArchive(entry: FormDataEntryValue | null): File {
  if (!(entry instanceof File)) {
    throw new RegistryError("manifest (JSON string) and archive (file) are required", 400);
  }

  if (!isTemplateArchiveFilename(entry.name)) {
    throw new RegistryError("archive must be a .tar.gz or .tgz file", 400);
  }

  return entry;
}

function parseTarEntries(archiveBuffer: Buffer): Set<string> {
  let tarBuffer: Uint8Array;
  try {
    tarBuffer = gunzipSync(archiveBuffer);
  } catch {
    throw new RegistryError("archive must be a valid gzip-compressed tarball", 400);
  }

  try {
    return new Set(readTemplateTarEntries(tarBuffer).map((entry) => entry.name));
  } catch (error) {
    throw new RegistryError(error instanceof Error ? error.message : String(error), 400);
  }
}

function validateArchiveManifest(manifest: TemplateManifestInput, archiveBuffer: Buffer): void {
  try {
    validateTemplatePackageContents({
      manifest,
      archivePaths: parseTarEntries(archiveBuffer),
      archiveSize: archiveBuffer.byteLength,
      maxArchiveBytes: maxArchiveBytes(),
    });
  } catch (error) {
    throw new RegistryError(error instanceof Error ? error.message : String(error), 400);
  }
}

export async function prepareTemplatePackage({
  manifestRaw,
  archive: archiveEntry,
}: TemplatePackageInput): Promise<PreparedTemplatePackage> {
  const manifest = await parseManifest(manifestRaw);
  const archive = parseArchive(archiveEntry);
  const archiveBuffer = Buffer.from(await archive.arrayBuffer());
  validateArchiveManifest(manifest, archiveBuffer);

  const sha256 = createHash("sha256").update(archiveBuffer).digest("hex");
  const archiveKey = `archives/${manifest.name}/${manifest.version}.tar.gz`;

  return { manifest, archiveBuffer, archiveKey, sha256 };
}
