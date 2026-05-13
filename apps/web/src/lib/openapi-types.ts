export interface OpenAPISpec {
  openapi: string;
  info: { title: string; version: string; description?: string };
  servers?: Array<{ url: string; description?: string }>;
  tags?: Array<{ name: string; description?: string }>;
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, Schema>;
    securitySchemes?: Record<string, SecurityScheme>;
  };
  security?: Record<string, string[]>[];
}

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete" | "head" | "options";

export type PathItem = Partial<Record<HttpMethod, Operation>>;

export interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses?: Record<string, ResponseObject>;
  security?: Record<string, string[]>[];
}

export interface Parameter {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required?: boolean;
  description?: string;
  schema?: Schema;
}

export interface RequestBody {
  required?: boolean;
  description?: string;
  content?: Record<string, MediaTypeObject>;
}

export interface ResponseObject {
  description?: string;
  content?: Record<string, MediaTypeObject>;
}

export interface MediaTypeObject {
  schema?: Schema;
  encoding?: Record<string, { contentType?: string }>;
}

export interface Schema {
  title?: string;
  type?: string | string[];
  format?: string;
  description?: string;
  properties?: Record<string, Schema>;
  additionalProperties?: boolean | Schema;
  items?: Schema;
  enum?: unknown[];
  required?: string[];
  nullable?: boolean;
  const?: unknown;
  default?: unknown;
  example?: unknown;
  examples?: unknown[];
  $ref?: string;
  allOf?: Schema[];
  anyOf?: Schema[];
  oneOf?: Schema[];
  discriminator?: { propertyName?: string; mapping?: Record<string, string> };
}

export interface SecurityScheme {
  type: string;
  scheme?: string;
  bearerFormat?: string;
  in?: string;
  name?: string;
  description?: string;
}

export interface SelectedOp {
  method: HttpMethod;
  path: string;
  operation: Operation;
}
