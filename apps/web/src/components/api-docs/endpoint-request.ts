import type {
  MediaTypeObject,
  OpenAPISpec,
  Operation,
  Parameter,
  Schema,
} from "@/lib/openapi-types";
import { exampleFromSchema, expandParameters, resolveSchema } from "./openapi-schema";

export type BodyKind = "none" | "json" | "multipart";

export interface MultipartField {
  name: string;
  schema: Schema;
  required: boolean;
  binary: boolean;
  contentType?: string;
}

export interface EndpointRequestDescriptor {
  parameters: Parameter[];
  pathParams: Parameter[];
  queryParams: Parameter[];
  headerParams: Parameter[];
  bodyKind: BodyKind;
  fields: MultipartField[];
  initialBody: string;
  initialMultipartValues: Record<string, string>;
}

export interface EndpointRequestInputs {
  pathValues: Record<string, string>;
  queryValues: Record<string, string>;
  headerValues: Record<string, string>;
  bearerToken: string;
  body: string;
  multipartValues: Record<string, string>;
  multipartFiles: Record<string, File | null>;
}

export interface EndpointRequest {
  url: string;
  headers: Record<string, string>;
  requestBody: BodyInit | undefined;
  snippets: { url: string; curl: string; fetch: string };
}

export function describeEndpointRequest({
  spec,
  operation,
  method,
  requestBodyContentType,
  requestBodyMedia,
}: {
  spec: OpenAPISpec;
  operation: Operation;
  method: string;
  requestBodyContentType?: string;
  requestBodyMedia?: MediaTypeObject;
}): EndpointRequestDescriptor {
  const parameters = expandParameters(operation.parameters ?? [], spec);
  const bodyKind = deriveBodyKind({ method, operation, requestBodyContentType });
  const fields = bodyKind === "multipart" ? deriveMultipartFields(requestBodyMedia, spec) : [];

  return {
    parameters,
    pathParams: parameters.filter((p) => p.in === "path"),
    queryParams: parameters.filter((p) => p.in === "query"),
    headerParams: parameters.filter((p) => p.in === "header"),
    bodyKind,
    fields,
    initialBody:
      bodyKind === "json" ? schemaExampleJson(requestBodyMedia?.schema, spec) : "",
    initialMultipartValues: Object.fromEntries(
      fields
        .filter((field) => !field.binary)
        .map((field) => [field.name, schemaExampleText(field.schema, spec)]),
    ),
  };
}

export function buildEndpointRequest({
  descriptor,
  apiUrl,
  path,
  method,
  requiresAuth,
  requestBodyContentType,
  inputs,
}: {
  descriptor: EndpointRequestDescriptor;
  apiUrl: string;
  path: string;
  method: string;
  requiresAuth: boolean;
  requestBodyContentType?: string;
  inputs: EndpointRequestInputs;
}): EndpointRequest {
  const url = buildUrl({ apiUrl, path, pathValues: inputs.pathValues, queryValues: inputs.queryValues });
  const urlString = url.toString();

  const displayHeaders = composeHeaders({
    requiresAuth,
    bearerToken: inputs.bearerToken,
    headerValues: inputs.headerValues,
    bodyKind: descriptor.bodyKind,
    requestBodyContentType,
  });

  const sendHeaders = { ...displayHeaders };
  if (requiresAuth && !inputs.bearerToken) delete sendHeaders.Authorization;

  const requestBody = assembleBody({
    bodyKind: descriptor.bodyKind,
    body: inputs.body,
    fields: descriptor.fields,
    multipartFiles: inputs.multipartFiles,
    multipartValues: inputs.multipartValues,
  });

  return {
    url: urlString,
    headers: sendHeaders,
    requestBody,
    snippets: {
      url: urlString,
      curl:
        descriptor.bodyKind === "multipart"
          ? multipartCurlSnippet({
              url: urlString,
              method,
              headers: displayHeaders,
              fields: descriptor.fields,
              values: inputs.multipartValues,
            })
          : curlSnippet({
              url: urlString,
              method,
              headers: displayHeaders,
              body: inputs.body,
              hasBody: descriptor.bodyKind === "json",
            }),
      fetch:
        descriptor.bodyKind === "multipart"
          ? multipartFetchSnippet({
              url: urlString,
              method,
              headers: displayHeaders,
              fields: descriptor.fields,
              values: inputs.multipartValues,
            })
          : fetchSnippet({
              url: urlString,
              method,
              headers: displayHeaders,
              body: inputs.body,
              hasBody: descriptor.bodyKind === "json",
            }),
    },
  };
}

function deriveBodyKind({
  method,
  operation,
  requestBodyContentType,
}: {
  method: string;
  operation: Operation;
  requestBodyContentType?: string;
}): BodyKind {
  const hasBody =
    ["post", "put", "patch"].includes(method.toLowerCase()) && !!operation.requestBody;
  if (!hasBody) return "none";
  return requestBodyContentType === "multipart/form-data" ? "multipart" : "json";
}

function deriveMultipartFields(
  media: MediaTypeObject | undefined,
  spec: OpenAPISpec,
): MultipartField[] {
  const schema = media?.schema ? resolveSchema(spec, media.schema) : undefined;
  const required = new Set(schema?.required ?? []);

  return Object.entries(schema?.properties ?? {}).map(([name, propertySchema]) => ({
    name,
    schema: propertySchema,
    required: required.has(name),
    binary: isBinarySchema(propertySchema, spec),
    contentType: media?.encoding?.[name]?.contentType,
  }));
}

function schemaExampleText(schema: Schema | undefined, spec: OpenAPISpec) {
  const example = exampleFromSchema(schema, spec, { empty: { key: "value" } });
  return typeof example === "string" ? example : JSON.stringify(example, null, 2);
}

function schemaExampleJson(schema: Schema | undefined, spec: OpenAPISpec) {
  return JSON.stringify(exampleFromSchema(schema, spec, { empty: { key: "value" } }), null, 2);
}

function buildUrl({
  apiUrl,
  path,
  pathValues,
  queryValues,
}: {
  apiUrl: string;
  path: string;
  pathValues: Record<string, string>;
  queryValues: Record<string, string>;
}): URL {
  const url = new URL(`${apiUrl}${interpolatePath(path, pathValues)}`);
  for (const [key, value] of Object.entries(queryValues)) {
    if (value) url.searchParams.set(key, value);
  }
  return url;
}

function composeHeaders({
  requiresAuth,
  bearerToken,
  headerValues,
  bodyKind,
  requestBodyContentType,
}: {
  requiresAuth: boolean;
  bearerToken: string;
  headerValues: Record<string, string>;
  bodyKind: BodyKind;
  requestBodyContentType?: string;
}) {
  const headers: Record<string, string> = {};
  if (requiresAuth) headers["Authorization"] = `Bearer ${bearerToken || "<api-key>"}`;
  for (const [key, value] of Object.entries(headerValues)) {
    if (value) headers[key] = value;
  }
  if (bodyKind === "json") headers["Content-Type"] = requestBodyContentType ?? "application/json";
  return headers;
}

function assembleBody({
  bodyKind,
  body,
  fields,
  multipartFiles,
  multipartValues,
}: {
  bodyKind: BodyKind;
  body: string;
  fields: MultipartField[];
  multipartFiles: Record<string, File | null>;
  multipartValues: Record<string, string>;
}): BodyInit | undefined {
  if (bodyKind === "json" && body) return body;
  if (bodyKind !== "multipart") return undefined;

  const formData = new FormData();
  for (const field of fields) {
    if (field.binary) {
      const file = multipartFiles[field.name];
      if (field.required && !file) throw new Error(`Choose a file for ${field.name}.`);
      if (file) formData.append(field.name, file);
      continue;
    }

    const value = multipartValues[field.name] ?? "";
    if (field.required && !value.trim()) throw new Error(`Enter a value for ${field.name}.`);

    if (field.contentType) {
      formData.append(field.name, new Blob([value], { type: field.contentType }));
    } else {
      formData.append(field.name, value);
    }
  }
  return formData;
}

function interpolatePath(path: string, params: Record<string, string>): string {
  return path.replace(/\{(\w+)\}/g, (_, key) =>
    params[key] ? encodeURIComponent(params[key]) : `{${key}}`,
  );
}

function isBinarySchema(schema: Schema | undefined, spec: OpenAPISpec) {
  if (!schema) return false;
  const resolved = resolveSchema(spec, schema);
  return resolved.type === "string" && resolved.format === "binary";
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function headerLines(headers: Record<string, string>) {
  return Object.entries(headers).map(
    ([key, value]) => `  -H ${shellQuote(`${key}: ${value}`)}`,
  );
}

function fetchSnippet({
  url,
  method,
  headers,
  body,
  hasBody,
}: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  hasBody: boolean;
}) {
  const init: Record<string, unknown> = { method: method.toUpperCase() };
  if (Object.keys(headers).length > 0) init.headers = headers;
  if (hasBody && body) init.body = body;

  return `const response = await fetch(${JSON.stringify(url)}, ${JSON.stringify(init, null, 2)});
const data = await response.json();`;
}

function curlSnippet({
  url,
  method,
  headers,
  body,
  hasBody,
}: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  hasBody: boolean;
}) {
  const lines = [`curl -X ${method.toUpperCase()} ${shellQuote(url)}`, ...headerLines(headers)];
  if (hasBody && body) lines.push(`  --data ${shellQuote(body)}`);
  return lines.join(" \\\n");
}

function multipartCurlSnippet({
  url,
  method,
  headers,
  fields,
  values,
}: {
  url: string;
  method: string;
  headers: Record<string, string>;
  fields: MultipartField[];
  values: Record<string, string>;
}) {
  const lines = [`curl -X ${method.toUpperCase()} ${shellQuote(url)}`, ...headerLines(headers)];
  for (const field of fields) {
    const typeSuffix = field.contentType ? `;type=${field.contentType}` : "";
    const value = field.binary
      ? `${field.name === "archive" ? "template.tar.gz" : field.name}${typeSuffix}`
      : `${values[field.name] ?? ""}${typeSuffix}`;
    lines.push(`  -F ${shellQuote(`${field.name}=${field.binary ? `@${value}` : value}`)}`);
  }
  return lines.join(" \\\n");
}

function multipartFetchSnippet({
  url,
  method,
  headers,
  fields,
  values,
}: {
  url: string;
  method: string;
  headers: Record<string, string>;
  fields: MultipartField[];
  values: Record<string, string>;
}) {
  const headerLinesText = Object.keys(headers).length
    ? `\n  headers: ${JSON.stringify(headers, null, 2).replace(/\n/g, "\n  ")},`
    : "";
  const formLines = fields.map((field) => {
    if (field.binary) {
      return `formData.append("${field.name}", ${field.name}File);`;
    }

    const value = values[field.name] ?? "";
    if (field.contentType) {
      return `formData.append("${field.name}", new Blob([${JSON.stringify(value)}], { type: "${field.contentType}" }));`;
    }
    return `formData.append("${field.name}", ${JSON.stringify(value)});`;
  });

  return `const formData = new FormData();
${formLines.join("\n")}

const response = await fetch(${JSON.stringify(url)}, {
  method: "${method.toUpperCase()}",${headerLinesText}
  body: formData,
});
const data = await response.json();`;
}
