import {
  inspectTemplateTarEntries,
  readTemplateTarEntries,
  validateTemplateManifest,
} from "@loadclass/registry-contract";
import { ApiRequestError } from "./api";

export interface PublishFormValues {
  name: string;
  version: string;
  description: string;
  license: string;
  category: string;
  homepage: string;
  repository: string;
  main: string;
  files: string;
}

export type PublishFormField = keyof PublishFormValues;

export interface PublishFormError {
  message: string;
  code?: string;
  detail?: string;
}

export const emptyPublishFormValues: PublishFormValues = {
  name: "",
  version: "",
  description: "",
  license: "MIT",
  category: "",
  homepage: "",
  repository: "",
  main: "",
  files: "",
};

const publishFormFields = Object.keys(emptyPublishFormValues) as PublishFormField[];

async function gunzip(data: ArrayBuffer): Promise<ArrayBuffer> {
  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  writer.write(data);
  writer.close();
  return new Response(ds.readable).arrayBuffer();
}

function manifestString(manifest: Record<string, unknown> | null, key: string): string | undefined {
  const value = manifest?.[key];
  return typeof value === "string" ? value : undefined;
}

export async function detectTemplatePackageFields(file: File): Promise<Partial<PublishFormValues>> {
  const raw = await file.arrayBuffer();
  const tarBuffer = await gunzip(raw);
  const inspection = inspectTemplateTarEntries(readTemplateTarEntries(new Uint8Array(tarBuffer)));
  const manifest = inspection.manifest;

  return {
    name: manifestString(manifest, "name"),
    version: manifestString(manifest, "version"),
    description: manifestString(manifest, "description"),
    license: manifestString(manifest, "license"),
    category: manifestString(manifest, "category"),
    homepage: manifestString(manifest, "homepage"),
    repository: inspection.repository,
    main: inspection.main,
    files: inspection.files.length > 0 ? inspection.files.join("\n") : undefined,
  };
}

export function fillDetectedPublishFields(
  current: PublishFormValues,
  detectedFields: Partial<PublishFormValues>,
): { form: PublishFormValues; detected: Set<PublishFormField> } {
  const form = { ...current };
  const detected = new Set<PublishFormField>();

  for (const field of publishFormFields) {
    const value = detectedFields[field];
    if (value) {
      form[field] = value;
      detected.add(field);
    }
  }

  return { form, detected };
}

export function buildTemplateManifest(form: PublishFormValues) {
  const manifestSource: Record<string, unknown> = {
    name: form.name.trim(),
    version: form.version.trim(),
    description: form.description.trim(),
    license: form.license.trim(),
    category: form.category.trim(),
    main: form.main.trim(),
    files: form.files
      .split("\n")
      .map((file) => file.trim())
      .filter(Boolean),
  };

  if (form.homepage.trim()) manifestSource.homepage = form.homepage.trim();
  if (form.repository.trim()) manifestSource.repository = form.repository.trim();

  return validateTemplateManifest(manifestSource);
}

export function publishFormErrorFromUnknown(error: unknown): PublishFormError {
  if (error instanceof ApiRequestError) {
    return {
      message: error.message,
      code: error.code,
      detail: error.detail,
    };
  }

  return { message: error instanceof Error ? error.message : String(error) };
}
