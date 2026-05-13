#!/usr/bin/env bun
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { gzipSync } from "node:zlib";
import {
  normalizeTemplatePackagePath,
  publishTemplatePath,
  validateTemplateManifest,
  type TemplateManifest as ManifestInput,
} from "@loadclass/registry-contract";

interface CliConfig {
  registry?: string;
  apiKey?: string;
}

interface PublishOptions {
  registry: string;
  apiKey: string;
  directory: string;
}

const CONFIG_DIR = join(homedir(), ".loadclass");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

function usage(exitCode = 0): never {
  console.log(`loadclass

Commands:
  loadclass login --api-key <key> [--registry <url>]
  loadclass publish <directory> [--api-key <key>] [--registry <url>]

Environment:
  LOADCLASS_API_KEY
  LOADCLASS_REGISTRY
`);
  process.exit(exitCode);
}

function parseArgs(args: string[]): { command: string; positional: string[]; flags: Record<string, string> } {
  const [command, ...rest] = args;
  if (!command || command === "-h" || command === "--help") usage(0);

  const positional: string[] = [];
  const flags: Record<string, string> = {};

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (!arg) continue;
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const key = arg.slice(2);
    const next = rest[i + 1];
    if (!next || next.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    flags[key] = next;
    i += 1;
  }

  return { command, positional, flags };
}

function readConfig(): CliConfig {
  if (!existsSync(CONFIG_PATH)) return {};
  return JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as CliConfig;
}

function writeConfig(config: CliConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}

function normalizeRegistry(url: string): string {
  return url.replace(/\/+$/, "");
}

function normalizeRelativePath(path: string): string {
  try {
    return normalizeTemplatePackagePath(path, "manifest");
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

function collectFiles(directory: string, entries: string[]): string[] {
  const files = new Set<string>(["loadclass.json"]);

  function addEntry(entry: string): void {
    const normalized = normalizeRelativePath(entry);
    const absolute = resolve(directory, normalized);
    if (!absolute.startsWith(`${resolve(directory)}${sep}`) && absolute !== resolve(directory)) {
      throw new Error(`Path escapes template directory: ${entry}`);
    }
    if (!existsSync(absolute)) throw new Error(`Manifest file does not exist: ${entry}`);

    const stat = statSync(absolute);
    if (stat.isDirectory()) {
      for (const child of readdirSync(absolute)) addEntry(`${normalized}/${child}`);
      return;
    }
    if (stat.isFile()) files.add(normalized);
  }

  for (const entry of entries) addEntry(entry);
  return [...files].sort();
}

function parseManifest(directory: string): ManifestInput {
  const manifestPath = join(directory, "loadclass.json");
  if (!existsSync(manifestPath)) throw new Error("Directory must contain loadclass.json");

  const manifest = validateTemplateManifest(JSON.parse(readFileSync(manifestPath, "utf8")));

  const files = collectFiles(directory, manifest.files);
  const main = normalizeRelativePath(manifest.main);
  if (!files.includes(main)) throw new Error("manifest.main must be listed in manifest.files");

  return { ...manifest, files };
}

function octal(value: number, length: number): string {
  return value.toString(8).padStart(length - 1, "0").slice(0, length - 1) + "\0";
}

function writeString(buffer: Buffer, offset: number, length: number, value: string): void {
  buffer.write(value.slice(0, length), offset, length, "utf8");
}

function tarHeader(name: string, size: number, mtime: number): Buffer {
  const header = Buffer.alloc(512);
  if (Buffer.byteLength(name) > 100) {
    throw new Error(`Path is too long for the built-in tar writer: ${name}`);
  }

  writeString(header, 0, 100, name);
  writeString(header, 100, 8, octal(0o644, 8));
  writeString(header, 108, 8, octal(0, 8));
  writeString(header, 116, 8, octal(0, 8));
  writeString(header, 124, 12, octal(size, 12));
  writeString(header, 136, 12, octal(mtime, 12));
  header.fill(" ", 148, 156);
  writeString(header, 156, 1, "0");
  writeString(header, 257, 6, "ustar");
  writeString(header, 263, 2, "00");

  let checksum = 0;
  for (const byte of header) checksum += byte;
  writeString(header, 148, 8, octal(checksum, 8));
  header[155] = 32;

  return header;
}

function createTarGz(directory: string, manifest: ManifestInput): Buffer {
  const chunks: Buffer[] = [];

  for (const file of manifest.files) {
    const absolute = join(directory, file);
    const stat = statSync(absolute);
    const contents = readFileSync(absolute);
    chunks.push(tarHeader(file, contents.byteLength, Math.floor(stat.mtimeMs / 1000)));
    chunks.push(contents);
    const padding = (512 - (contents.byteLength % 512)) % 512;
    if (padding) chunks.push(Buffer.alloc(padding));
  }

  chunks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(chunks));
}

async function publish(options: PublishOptions): Promise<void> {
  const directory = resolve(options.directory);
  const manifest = parseManifest(directory);
  const archive = createTarGz(directory, manifest);
  const archiveBytes = new Uint8Array(archive.byteLength);
  archiveBytes.set(archive);
  const archiveName = `${manifest.name.replace("/", "-")}-${manifest.version}.tar.gz`;

  const body = new FormData();
  body.set("manifest", JSON.stringify(manifest));
  body.set("archive", new Blob([archiveBytes.buffer], { type: "application/gzip" }), archiveName);

  const response = await fetch(`${options.registry}${publishTemplatePath()}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${options.apiKey}` },
    body,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String(payload.error)
        : `Publish failed with ${response.status}`;
    throw new Error(message);
  }

  console.log(`Published ${manifest.name}@${manifest.version}`);
}

async function main(): Promise<void> {
  const { command, positional, flags } = parseArgs(process.argv.slice(2));
  const config = readConfig();

  if (command === "login") {
    const apiKey = flags["api-key"];
    if (!apiKey) throw new Error("login requires --api-key <key>");
    writeConfig({
      ...config,
      apiKey,
      registry: normalizeRegistry(flags.registry ?? config.registry ?? "http://localhost:8080"),
    });
    console.log(`Stored credentials for ${flags.registry ?? config.registry ?? "http://localhost:8080"}`);
    return;
  }

  if (command === "publish") {
    const [directory] = positional;
    if (!directory) throw new Error("publish requires a template directory");
    const registry = normalizeRegistry(
      flags.registry ?? process.env.LOADCLASS_REGISTRY ?? config.registry ?? "http://localhost:8080",
    );
    const apiKey = flags["api-key"] ?? process.env.LOADCLASS_API_KEY ?? config.apiKey;
    if (!apiKey) throw new Error("Missing API key. Run login or set LOADCLASS_API_KEY.");
    await publish({ directory, registry, apiKey });
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
