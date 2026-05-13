import semver from "semver";
import { z } from "zod";

export const TEMPLATE_NAME_RE = /^(?:@[a-z0-9][a-z0-9-]*\/)?[a-z0-9][a-z0-9-]*$/;
export const LOADCLASS_MANIFEST = "loadclass.json";
export const DEFAULT_MAX_ARCHIVE_BYTES = 25 * 1024 * 1024;

export const TemplateManifest = z.object({
  name: z.string(),
  title: z.string().optional(),
  version: z.string(),
  description: z.string(),
  license: z.string(),
  category: z.string(),
  homepage: z.string().url().optional(),
  repository: z.string().url().optional(),
  sourceType: z.enum(["official", "community", "unknown"]).optional(),
  sourceUrl: z.string().url().optional(),
  publisher: z.string().optional(),
  readme: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  main: z.string(),
  files: z.array(z.string()),
  engines: z
    .object({
      latex: z.string().optional(),
      luatex: z.string().optional(),
      xetex: z.string().optional(),
    })
    .optional(),
});

export type TemplateManifest = z.infer<typeof TemplateManifest>;

export interface TemplateTarEntry {
  name: string;
  content: Uint8Array;
  typeFlag: string;
  size: number;
}

export interface TemplatePackageInspection {
  manifest: Record<string, unknown> | null;
  files: string[];
  main: string | undefined;
  repository: string | undefined;
}

export interface TemplatePackageContentValidation {
  manifest: TemplateManifest;
  archivePaths: Iterable<string>;
  archiveSize?: number;
  maxArchiveBytes?: number;
}

export function isValidTemplateName(name: string): boolean {
  return TEMPLATE_NAME_RE.test(name);
}

export function isTemplateArchiveFilename(name: string): boolean {
  return name.endsWith(".tar.gz") || name.endsWith(".tgz");
}

export function normalizeTemplatePackagePath(path: string, label = "template package"): string {
  const normalized = path.replace(/\\/g, "/").replace(/^\.\//, "");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized.includes("\0") ||
    normalized.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error(`Invalid ${label} path: ${path}`);
  }
  return normalized;
}

export function parseTemplateManifestSource(source: string): TemplateManifest {
  let manifestJson: unknown;
  try {
    manifestJson = JSON.parse(source);
  } catch {
    throw new Error("manifest must be valid JSON");
  }

  return validateTemplateManifest(manifestJson);
}

export function validateTemplateManifest(manifestJson: unknown): TemplateManifest {
  const parsed = TemplateManifest.safeParse(manifestJson);
  if (!parsed.success) throw new Error(parsed.error.message);

  if (!semver.valid(parsed.data.version)) {
    throw new Error("manifest.version must be valid semver");
  }

  if (!isValidTemplateName(parsed.data.name)) {
    throw new Error("manifest.name must be a lowercase slug, optionally scoped as @org/template");
  }

  const manifestFiles = parsed.data.files.map((path) => normalizeTemplatePackagePath(path, "manifest"));
  const main = normalizeTemplatePackagePath(parsed.data.main, "manifest");
  if (!manifestFiles.includes(main)) {
    throw new Error("manifest.main must be listed in manifest.files");
  }

  return { ...parsed.data, main, files: manifestFiles };
}

export function readTemplateTarEntries(tarData: Uint8Array): TemplateTarEntry[] {
  const entries: TemplateTarEntry[] = [];
  let offset = 0;

  while (offset + 512 <= tarData.length) {
    const header = tarData.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;

    const name = readTarString(tarData, offset, 100);
    const prefix = readTarString(tarData, offset + 345, 155);
    const fullName = prefix ? `${prefix}/${name}` : name;
    const size = readTarOctal(tarData, offset + 124, 12);
    const typeFlag = String.fromCharCode(tarData[offset + 156] ?? 0);

    offset += 512;

    if (!["5", "L", "x", "g"].includes(typeFlag) && fullName) {
      entries.push({
        name: normalizeTemplatePackagePath(fullName, "archive"),
        content: tarData.slice(offset, offset + size),
        typeFlag,
        size,
      });
    }

    offset += Math.ceil(size / 512) * 512;
  }

  return entries;
}

export function commonTemplateArchivePrefix(paths: string[]): string {
  if (paths.length === 0) return "";
  const [first] = paths;
  if (!first) return "";
  const parts = first.split("/");
  let prefix = "";

  for (let i = 0; i < parts.length - 1; i += 1) {
    const candidate = `${parts.slice(0, i + 1).join("/")}/`;
    if (paths.every((path) => path.startsWith(candidate))) prefix = candidate;
    else break;
  }

  return prefix;
}

export function stripCommonTemplateArchivePrefix(path: string, prefix: string): string {
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

export function inspectTemplateTarEntries(entries: TemplateTarEntry[]): TemplatePackageInspection {
  const allNames = entries.map((entry) => entry.name);
  const prefix = commonTemplateArchivePrefix(allNames);
  const files = allNames
    .map((name) => stripCommonTemplateArchivePrefix(name, prefix))
    .filter(Boolean);

  const manifestEntry = entries.find(
    (entry) => stripCommonTemplateArchivePrefix(entry.name, prefix) === LOADCLASS_MANIFEST,
  );
  const manifest = manifestEntry ? parseLooseManifest(manifestEntry.content) : null;
  const texFiles = files.filter((file) => file.endsWith(".tex"));
  const main =
    manifestString(manifest, "main") ??
    texFiles.find((file) => file === "main.tex") ??
    texFiles.find((file) => file.toLowerCase().includes("main")) ??
    texFiles[0];

  return {
    manifest,
    files,
    main,
    repository: manifestRepositoryUrl(manifest),
  };
}

export function validateTemplatePackageContents({
  manifest,
  archivePaths,
  archiveSize,
  maxArchiveBytes = DEFAULT_MAX_ARCHIVE_BYTES,
}: TemplatePackageContentValidation): void {
  if (archiveSize != null && archiveSize > maxArchiveBytes) {
    throw new Error(`archive exceeds ${maxArchiveBytes} bytes`);
  }

  const normalizedArchivePaths = [...archivePaths].map((path) =>
    normalizeTemplatePackagePath(path, "archive"),
  );
  if (normalizedArchivePaths.length === 0) throw new Error("archive must contain files");

  const prefix = commonTemplateArchivePrefix(normalizedArchivePaths);
  const archivePathSet = new Set([
    ...normalizedArchivePaths,
    ...normalizedArchivePaths.map((path) => stripCommonTemplateArchivePrefix(path, prefix)),
  ]);
  const manifestFiles = new Set(
    manifest.files.map((path) => normalizeTemplatePackagePath(path, "manifest")),
  );
  const main = normalizeTemplatePackagePath(manifest.main, "manifest");

  if (!manifestFiles.has(main)) {
    throw new Error("manifest.main must be listed in manifest.files");
  }

  const missingFiles = [...manifestFiles].filter((path) => !archivePathSet.has(path));
  if (missingFiles.length > 0) {
    throw new Error(`archive is missing manifest files: ${missingFiles.join(", ")}`);
  }

  if (!archivePathSet.has(LOADCLASS_MANIFEST)) {
    throw new Error("archive must include loadclass.json at its root");
  }
}

function readTarString(buffer: Uint8Array, start: number, length: number): string {
  const raw = buffer.subarray(start, start + length);
  const nul = raw.indexOf(0);
  return new TextDecoder().decode(raw.subarray(0, nul === -1 ? raw.length : nul)).trim();
}

function readTarOctal(buffer: Uint8Array, start: number, length: number): number {
  const value = readTarString(buffer, start, length).replace(/\0/g, "").trim();
  return value ? Number.parseInt(value, 8) || 0 : 0;
}

function parseLooseManifest(content: Uint8Array): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(content));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function manifestString(manifest: Record<string, unknown> | null, key: string): string | undefined {
  const value = manifest?.[key];
  return typeof value === "string" ? value : undefined;
}

function manifestRepositoryUrl(manifest: Record<string, unknown> | null): string | undefined {
  const repository = manifest?.repository;
  if (typeof repository === "string") return repository;
  if (repository && typeof repository === "object" && "url" in repository) {
    const url = (repository as { url?: unknown }).url;
    return typeof url === "string" ? url : undefined;
  }
  return undefined;
}
