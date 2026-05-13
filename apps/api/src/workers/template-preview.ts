import {
  DEFAULT_MAX_ARCHIVE_BYTES,
  LOADCLASS_MANIFEST,
  commonTemplateArchivePrefix,
  normalizeTemplatePackagePath,
  readTemplateTarEntries,
  stripCommonTemplateArchivePrefix,
  validateTemplateManifest,
  validateTemplatePackageContents,
  type TemplateManifest,
  type TemplateTarEntry,
} from "@loadclass/registry-contract";
import { spawn } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { constants as fsConstants } from "node:fs";
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { gunzipSync } from "node:zlib";
import { assertPreviewWorkerRuntimeConfig } from "../runtime-config.ts";

assertPreviewWorkerRuntimeConfig();

const DEFAULT_PORT = 8090;
const DEFAULT_JOB_TIMEOUT_MS = 30_000;
const DEFAULT_COMMAND_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_REQUEST_BYTES = 40 * 1024 * 1024;
const DEFAULT_MAX_EXTRACTED_BYTES = 80 * 1024 * 1024;
const DEFAULT_MAX_FILES = 300;
const DEFAULT_MAX_THUMBNAIL_BYTES = 3 * 1024 * 1024;
const LOG_LIMIT_BYTES = 64 * 1024;

interface PreviewRequestPayload {
  manifest: unknown;
  archiveBase64: unknown;
}

class PreviewError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = "preview_error",
  ) {
    super(message);
  }
}

class PreviewCommandError extends PreviewError {
  constructor(
    readonly command: string,
    message: string,
    readonly output: string,
  ) {
    super(message, 422, `${command}_failed`);
  }
}

interface PublicPreviewIssue {
  code: string;
  message: string;
  detail?: string;
}

function configuredInt(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function maxArchiveBytes(): number {
  return configuredInt("MAX_ARCHIVE_BYTES", DEFAULT_MAX_ARCHIVE_BYTES);
}

function maxRequestBytes(): number {
  return configuredInt("MAX_PREVIEW_REQUEST_BYTES", DEFAULT_MAX_REQUEST_BYTES);
}

function maxExtractedBytes(): number {
  return configuredInt("MAX_PREVIEW_EXTRACTED_BYTES", DEFAULT_MAX_EXTRACTED_BYTES);
}

function maxFiles(): number {
  return configuredInt("MAX_PREVIEW_FILES", DEFAULT_MAX_FILES);
}

function jobTimeoutMs(): number {
  return configuredInt("PREVIEW_WORKER_JOB_TIMEOUT_MS", DEFAULT_JOB_TIMEOUT_MS);
}

function commandTimeoutMs(): number {
  return configuredInt("PREVIEW_WORKER_COMMAND_TIMEOUT_MS", DEFAULT_COMMAND_TIMEOUT_MS);
}

function maxThumbnailBytes(): number {
  return configuredInt("MAX_THUMBNAIL_BYTES", DEFAULT_MAX_THUMBNAIL_BYTES);
}

function authorize(req: IncomingMessage): void {
  const token = process.env.PREVIEW_WORKER_TOKEN?.trim();
  if (!token) return;

  if (req.headers.authorization !== `Bearer ${token}`) {
    throw new PreviewError("unauthorized", 401);
  }
}

async function readRequestBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  const limit = maxRequestBytes();

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.byteLength;
    if (total > limit) throw new PreviewError(`request exceeds ${limit} bytes`, 413);
    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

async function readPayload(req: IncomingMessage): Promise<{
  manifest: TemplateManifest;
  entries: TemplateTarEntry[];
}> {
  const body = await readRequestBody(req);
  let payload: PreviewRequestPayload;

  try {
    payload = JSON.parse(body.toString("utf8")) as PreviewRequestPayload;
  } catch {
    throw new PreviewError("request body must be JSON");
  }

  const manifest = validateTemplateManifest(payload.manifest);
  if (typeof payload.archiveBase64 !== "string" || !payload.archiveBase64) {
    throw new PreviewError("archiveBase64 is required");
  }

  const archiveBuffer = Buffer.from(payload.archiveBase64, "base64");
  if (archiveBuffer.byteLength === 0) throw new PreviewError("archive is empty");
  if (archiveBuffer.byteLength > maxArchiveBytes()) {
    throw new PreviewError(`archive exceeds ${maxArchiveBytes()} bytes`, 413);
  }

  let tarBuffer: Uint8Array;
  try {
    tarBuffer = gunzipSync(archiveBuffer);
  } catch {
    throw new PreviewError("archive must be a valid gzip-compressed tarball");
  }

  let entries: TemplateTarEntry[];
  try {
    entries = readTemplateTarEntries(tarBuffer);
  } catch (error) {
    throw new PreviewError(error instanceof Error ? error.message : String(error));
  }

  validateTemplatePackageContents({
    manifest,
    archivePaths: entries.map((entry) => entry.name),
    archiveSize: archiveBuffer.byteLength,
    maxArchiveBytes: maxArchiveBytes(),
  });

  return { manifest, entries };
}

function safeDestination(root: string, relativePath: string): string {
  const normalized = normalizeTemplatePackagePath(relativePath, "manifest");
  const destination = resolve(root, ...normalized.split("/"));
  const rootWithSeparator = root.endsWith(sep) ? root : `${root}${sep}`;
  if (destination !== root && !destination.startsWith(rootWithSeparator)) {
    throw new PreviewError(`invalid archive path: ${relativePath}`);
  }
  return destination;
}

async function extractDeclaredFiles(
  root: string,
  manifest: TemplateManifest,
  entries: TemplateTarEntry[],
): Promise<void> {
  const archiveNames = entries.map((entry) => entry.name);
  const prefix = commonTemplateArchivePrefix(archiveNames);
  const allowedFiles = new Set([LOADCLASS_MANIFEST, ...manifest.files]);
  let extractedBytes = 0;
  let extractedFiles = 0;

  for (const entry of entries) {
    const relativePath = stripCommonTemplateArchivePrefix(entry.name, prefix);
    if (!allowedFiles.has(relativePath)) continue;

    extractedFiles += 1;
    if (extractedFiles > maxFiles()) throw new PreviewError(`archive exceeds ${maxFiles()} files`);

    extractedBytes += entry.size;
    if (extractedBytes > maxExtractedBytes()) {
      throw new PreviewError(`archive expands beyond ${maxExtractedBytes()} bytes`);
    }

    const destination = safeDestination(root, relativePath);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, entry.content);
  }

  await access(safeDestination(root, LOADCLASS_MANIFEST), fsConstants.R_OK);
  await access(safeDestination(root, manifest.main), fsConstants.R_OK);
}

type LatexEngine = "pdflatex" | "xelatex" | "lualatex";

function normalizeLatexEngine(engine: string | undefined): LatexEngine | null {
  const normalized = engine?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "latex" || normalized === "pdflatex" || normalized === "pdftex") {
    return "pdflatex";
  }
  if (normalized === "xelatex" || normalized === "xetex") return "xelatex";
  if (normalized === "lualatex" || normalized === "luatex") return "lualatex";
  return null;
}

function sourceEngineHint(source: string): LatexEngine | null {
  const magic = source.match(/^\s*%\s*!T[eE]X\s+(?:program|TS-program)\s*=\s*([^\s]+)/m);
  const magicEngine = normalizeLatexEngine(magic?.[1]);
  if (magicEngine) return magicEngine;

  if (
    /\\usepackage(?:\[[^\]]*\])?\{[^}]*fontspec/i.test(source) ||
    /\\(?:setmainfont|setsansfont|setmonofont|newfontfamily)\b/i.test(source)
  ) {
    return "xelatex";
  }

  if (
    /\\usepackage(?:\[[^\]]*\])?\{[^}]*ctex/i.test(source) ||
    /\\documentclass(?:\[[^\]]*\])?\{ctex/i.test(source)
  ) {
    return "xelatex";
  }

  return null;
}

async function latexEngines(manifest: TemplateManifest, mainPath: string): Promise<LatexEngine[]> {
  const explicitEngine =
    normalizeLatexEngine(manifest.engines?.latex) ??
    (manifest.engines?.xetex ? "xelatex" : null) ??
    (manifest.engines?.luatex ? "lualatex" : null);
  if (explicitEngine) return [explicitEngine];

  const source = await readFile(mainPath, "utf8").catch(() => "");
  const hintedEngine = sourceEngineHint(source);
  if (hintedEngine) {
    return [...new Set<LatexEngine>([hintedEngine, "pdflatex"])];
  }

  return ["pdflatex"];
}

async function collectStream(stream: NodeJS.ReadableStream | null): Promise<string> {
  if (!stream) return "";

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    if (total >= LOG_LIMIT_BYTES) continue;
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    const remaining = LOG_LIMIT_BYTES - total;
    chunks.push(buffer.subarray(0, remaining));
    total += Math.min(buffer.byteLength, remaining);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function runCommand(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, commandTimeoutMs());
    const output = Promise.all([collectStream(child.stdout), collectStream(child.stderr)]);

    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(
        new PreviewError(`${command} could not start: ${error.message}`, 500, "command_unavailable"),
      );
    });

    child.once("close", (code) => {
      clearTimeout(timeout);
      void output
        .then(([stdout, stderr]) => {
          if (timedOut) {
            reject(new PreviewError(`${command} timed out`, 422, `${command}_timeout`));
            return;
          }
          if (code !== 0) {
            reject(
              new PreviewCommandError(
                command,
                `${command} failed with exit code ${code}`,
                `${stdout}\n${stderr}`.slice(0, LOG_LIMIT_BYTES),
              ),
            );
            return;
          }
          resolvePromise();
        })
        .catch(reject);
    });
  });
}

function commandEnvironment(root: string): NodeJS.ProcessEnv {
  return {
    PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    HOME: root,
    TMPDIR: root,
    TEXMFOUTPUT: root,
    TEXINPUTS: `.:${root}//:`,
    openin_any: "p",
    openout_any: "p",
    OPENIN_ANY: "p",
    OPENOUT_ANY: "p",
    SOURCE_DATE_EPOCH: "0",
  };
}

async function renderPreview(manifest: TemplateManifest, root: string): Promise<Buffer> {
  const buildDir = join(root, ".preview-build");
  await mkdir(buildDir, { recursive: true });

  const mainPath = safeDestination(root, manifest.main);
  await assertReadableNonEmptyFile(mainPath);
  const mainDir = dirname(mainPath);
  const mainFile = mainPath.slice(mainDir.length + 1);
  const engines = await latexEngines(manifest, mainPath);
  const env = commandEnvironment(root);

  let lastError: unknown;
  for (const engine of engines) {
    try {
      const pdfPath = await compileLatexToPdf(engine, buildDir, root, mainDir, mainFile, env);
      return await renderPdfToPng(root, buildDir, env, pdfPath);
    } catch (error) {
      lastError = error;
    }
  }

  for (const pdfPath of await findPackagedPdfs(root, manifest)) {
    try {
      return await renderPdfToPng(root, buildDir, env, pdfPath);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new PreviewError("preview could not be rendered", 422);
}

async function compileLatexToPdf(
  engine: LatexEngine,
  buildDir: string,
  root: string,
  mainDir: string,
  mainFile: string,
  env: NodeJS.ProcessEnv,
): Promise<string> {
  const pdfPath = join(buildDir, `${mainFile.replace(/\.tex$/i, "")}.pdf`);
  try {
    await runLatex(engine, buildDir, mainDir, mainFile, env);
    await assertReadableNonEmptyFile(pdfPath);
    return pdfPath;
  } catch (error) {
    if (
      error instanceof PreviewCommandError &&
      (await createMissingStyleAlias(root, mainDir, error.output))
    ) {
      await runLatex(engine, buildDir, mainDir, mainFile, env);
      await assertReadableNonEmptyFile(pdfPath);
      return pdfPath;
    }
    throw error;
  }
}

async function runLatex(
  engine: string,
  buildDir: string,
  mainDir: string,
  mainFile: string,
  env: NodeJS.ProcessEnv,
): Promise<void> {
  await runCommand(
    engine,
    [
      "-interaction=nonstopmode",
      "-halt-on-error",
      "-file-line-error",
      "-no-shell-escape",
      "-output-directory",
      buildDir,
      mainFile,
    ],
    mainDir,
    env,
  );
}

function missingStyleFilename(output: string): string | null {
  const match = output.match(/File `([^`']+\.sty)' not found/);
  return match?.[1] ?? null;
}

function styleFamily(filename: string): string {
  const stem = filename.replace(/\.sty$/i, "").toLowerCase();
  return stem.match(/^[a-z]+/)?.[0] ?? stem;
}

function outputMatch(output: string, pattern: RegExp): string | undefined {
  const match = output.match(pattern);
  return match?.[1]?.trim();
}

function classifyCommandFailure(error: PreviewCommandError): PublicPreviewIssue {
  const output = error.output;
  const missingStyle = outputMatch(output, /(?:File|LaTeX Error: File) [`']([^`']+\.sty)'? not found/i);
  if (missingStyle) {
    return {
      code: "missing_latex_package",
      message: "LaTeX package is missing.",
      detail: `Missing ${missingStyle}.`,
    };
  }

  const missingClass = outputMatch(output, /(?:File|LaTeX Error: File) [`']([^`']+\.cls)'? not found/i);
  if (missingClass) {
    return {
      code: "missing_latex_class",
      message: "LaTeX document class is missing.",
      detail: `Missing ${missingClass}.`,
    };
  }

  const babelLanguage = outputMatch(output, /Package babel Error: Unknown option [`']?([^`'.\n]+)[`']?/i);
  if (babelLanguage) {
    return {
      code: "missing_latex_language",
      message: "LaTeX language support is missing.",
      detail: `Missing Babel language support for ${babelLanguage}.`,
    };
  }

  const failedImage =
    outputMatch(output, /\(file ([^)]+)\):\s*reading image file failed/i) ??
    outputMatch(output, /Unable to load picture or PDF file [`']([^`']+)'/i);
  if (failedImage) {
    return {
      code: "invalid_image_asset",
      message: "An image or PDF asset could not be read.",
      detail: `Check ${failedImage.split("/").pop()}.`,
    };
  }

  if (
    /Shell escape feature is not enabled/i.test(output) ||
    /-eps-converted-to\.pdf/i.test(output) ||
    /Image inclusion failed for [`"][^`"]+\.eps/i.test(output)
  ) {
    return {
      code: "unsupported_eps_conversion",
      message: "The template needs EPS/image conversion that is disabled for security.",
      detail: "Convert EPS assets to PDF or PNG and reference those files directly.",
    };
  }

  if (/no legal \\end found/i.test(output)) {
    return {
      code: "incomplete_tex_source",
      message: "The main TeX file looks incomplete.",
      detail: "The file may be empty or missing its document ending.",
    };
  }

  if (/fontspec.*requires either XeTeX or\s*\(fontspec\)\s*LuaTeX/is.test(output)) {
    return {
      code: "wrong_latex_engine",
      message: "The template requires XeLaTeX or LuaLaTeX.",
      detail: "Add an engine hint to the manifest or the main TeX file.",
    };
  }

  if (error.command === "pdftocairo") {
    return {
      code: "pdf_render_failed",
      message: "The compiled PDF could not be converted into a thumbnail.",
    };
  }

  return {
    code: "latex_compile_failed",
    message: "The template did not compile in the preview sandbox.",
    detail: "Check the main file, required assets, and LaTeX package dependencies.",
  };
}

function publicPreviewIssue(error: unknown): PublicPreviewIssue {
  if (error instanceof PreviewCommandError) return classifyCommandFailure(error);
  if (error instanceof PreviewError) {
    if (
      error.code === "pdflatex_timeout" ||
      error.code === "xelatex_timeout" ||
      error.code === "lualatex_timeout"
    ) {
      return {
        code: "latex_compile_timeout",
        message: "LaTeX compilation took too long.",
        detail: "Simplify the template preview or check for loops and expensive generated content.",
      };
    }
    if (error.code === "empty_file") {
      return {
        code: error.code,
        message: "The main TeX file is empty.",
        detail: "Choose a non-empty entry point for preview compilation.",
      };
    }
    if (error.code === "file_not_readable") {
      return {
        code: error.code,
        message: "The main TeX file could not be read.",
        detail: "Check that the manifest entry point points to a readable file in the archive.",
      };
    }
    if (error.code === "preview_job_timeout") {
      return {
        code: error.code,
        message: "Preview generation took too long.",
        detail: "Simplify the template preview or check for expensive generated content.",
      };
    }
    if (error.code === "thumbnail_size_rejected") {
      return {
        code: error.code,
        message: "The generated thumbnail was empty or too large.",
      };
    }
    return { code: error.code, message: error.message };
  }
  return {
    code: "preview_worker_error",
    message: "The preview worker could not build a thumbnail.",
  };
}

async function createMissingStyleAlias(
  root: string,
  mainDir: string,
  output: string,
): Promise<boolean> {
  const missing = missingStyleFilename(output);
  if (!missing) return false;

  const destination = resolve(mainDir, missing);
  const rootWithSeparator = root.endsWith(sep) ? root : `${root}${sep}`;
  if (!destination.startsWith(rootWithSeparator)) return false;
  if (await readableFile(destination)) return false;

  const localStyles = (await readdir(mainDir)).filter((file) => file.toLowerCase().endsWith(".sty"));
  const sameFamilyStyles = localStyles.filter(
    (file) => styleFamily(file) === styleFamily(missing),
  );
  if (sameFamilyStyles.length !== 1) return false;

  await copyFile(resolve(mainDir, sameFamilyStyles[0]!), destination);
  return true;
}

async function renderPdfToPng(
  root: string,
  buildDir: string,
  env: NodeJS.ProcessEnv,
  pdfPath: string,
): Promise<Buffer> {
  const previewPathBase = join(buildDir, "preview");
  await runCommand(
    "pdftocairo",
    ["-png", "-singlefile", "-f", "1", "-l", "1", "-r", "96", pdfPath, previewPathBase],
    root,
    env,
  );

  const previewPath = `${previewPathBase}.png`;
  const preview = await readFile(previewPath);
  if (preview.byteLength === 0 || preview.byteLength > maxThumbnailBytes()) {
    throw new PreviewError(
      `thumbnail size rejected: ${preview.byteLength} bytes`,
      422,
      "thumbnail_size_rejected",
    );
  }
  return preview;
}

async function readableFile(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function assertReadableNonEmptyFile(path: string): Promise<void> {
  let info: Awaited<ReturnType<typeof stat>>;
  try {
    info = await stat(path);
  } catch {
    throw new PreviewError("file is not readable", 422, "file_not_readable");
  }

  if (!info.isFile() || info.size === 0) {
    throw new PreviewError("file is empty or not a regular file", 422, "empty_file");
  }
}

async function readableNonEmptyFile(path: string): Promise<boolean> {
  try {
    await assertReadableNonEmptyFile(path);
    return true;
  } catch {
    return false;
  }
}

async function findPackagedPdfs(root: string, manifest: TemplateManifest): Promise<string[]> {
  const candidates: string[] = [];
  const mainPdf = manifest.main.replace(/\.tex$/i, ".pdf");
  if (mainPdf !== manifest.main) {
    candidates.push(mainPdf);
  }

  const mainBase = mainPdf.split("/").pop()?.toLowerCase();
  const pdfFiles = manifest.files.filter((file) => file.toLowerCase().endsWith(".pdf"));
  if (mainBase) {
    const sameName = pdfFiles.find((file) => file.split("/").pop()?.toLowerCase() === mainBase);
    if (sameName) candidates.push(sameName);
  }
  candidates.push(...pdfFiles);

  const orderedUniqueCandidates = [...new Set(candidates)];
  const paths: string[] = [];
  for (const file of orderedUniqueCandidates) {
    const candidate = safeDestination(root, file);
    if (await readableNonEmptyFile(candidate)) paths.push(candidate);
  }
  return paths;
}

async function withJobTimeout<T>(work: Promise<T>): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  const timer = new Promise<T>((_, reject) => {
    timeout = setTimeout(
      () => reject(new PreviewError("preview job timed out", 422, "preview_job_timeout")),
      jobTimeoutMs(),
    );
  });

  try {
    return await Promise.race([work, timer]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function handleRender(req: IncomingMessage, res: ServerResponse): Promise<void> {
  authorize(req);
  const { manifest, entries } = await readPayload(req);
  const root = await mkdtemp(join(tmpdir(), "loadclass-preview-"));

  try {
    const png = await withJobTimeout(
      (async () => {
        await extractDeclaredFiles(root, manifest, entries);
        return renderPreview(manifest, root);
      })(),
    );
    res.writeHead(200, {
      "content-type": "image/png",
      "cache-control": "no-store",
      "content-length": png.byteLength,
    });
    res.end(png);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
    "content-length": payload.byteLength,
  });
  res.end(payload);
}

const server = createServer((req, res) => {
  void (async () => {
    try {
      if (req.method === "GET" && req.url === "/healthz") {
        sendJson(res, 200, { ok: true });
        return;
      }
      if (req.method === "POST" && req.url === "/render") {
        await handleRender(req, res);
        return;
      }
      sendJson(res, 404, { error: "not found" });
    } catch (error) {
      const status = error instanceof PreviewError ? error.status : 500;
      const message = error instanceof Error ? error.message : String(error);
      const issue = publicPreviewIssue(error);
      console.warn(`[template-preview-worker] ${status}: ${message}`);
      sendJson(res, status, { error: issue.message, code: issue.code, detail: issue.detail });
    }
  })();
});

const port = configuredInt("PREVIEW_WORKER_PORT", DEFAULT_PORT);
server.listen(port, "0.0.0.0", () => {
  console.log(`[template-preview-worker] listening on ${port}`);
});
