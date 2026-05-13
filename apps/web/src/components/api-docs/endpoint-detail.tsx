import { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import Markdown from "react-markdown";
import type {
  OpenAPISpec,
  SelectedOp,
  Parameter,
  ResponseObject,
  Schema,
  MediaTypeObject,
} from "@/lib/openapi-types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { MethodBadge } from "./method-badge";
import { SchemaView } from "./schema-view";
import { EndpointTryIt } from "./endpoint-try-it";
import { CopyButton } from "./copy-button";
import { expandParameters } from "./openapi-schema";

interface Props {
  spec: OpenAPISpec;
  op: SelectedOp;
  apiUrl: string;
}

function statusVariant(status: string): "default" | "secondary" | "destructive" {
  if (status.startsWith("2")) return "default";
  if (status.startsWith("4") || status.startsWith("5")) return "destructive";
  return "secondary";
}

function operationRequiresAuth(spec: OpenAPISpec, operation: SelectedOp["operation"]) {
  const security = operation.security ?? spec.security;
  return !!security?.some((entry) => Object.keys(entry).length > 0);
}

function requestBodyForTryIt(content?: Record<string, MediaTypeObject>) {
  if (!content) return undefined;
  const preferredContentType = content["application/json"]
    ? "application/json"
    : content["multipart/form-data"]
      ? "multipart/form-data"
      : Object.keys(content)[0];
  if (!preferredContentType) return undefined;
  return { contentType: preferredContentType, media: content[preferredContentType] };
}

function schemaEntries(content?: Record<string, MediaTypeObject>) {
  return Object.entries(content ?? {}).filter((entry): entry is [string, { schema: Schema }] =>
    Boolean(entry[1].schema),
  );
}

function parameterExampleValue(param: Parameter) {
  if (param.schema?.default !== undefined) return String(param.schema.default);
  if (param.schema?.enum?.length) return String(param.schema.enum[0]);

  const type = Array.isArray(param.schema?.type)
    ? param.schema.type.find((value) => value !== "null")
    : param.schema?.type;

  if (type === "number" || type === "integer") return "0";
  if (type === "boolean") return "true";
  return param.name;
}

function parameterCopyValue(params: Parameter[]) {
  if (params[0]?.in === "query") {
    const search = new URLSearchParams();
    for (const param of params) {
      search.set(param.name, parameterExampleValue(param));
    }
    const value = search.toString();
    return value ? `?${value}` : "";
  }

  return JSON.stringify(
    Object.fromEntries(params.map((param) => [param.name, parameterExampleValue(param)])),
    null,
    2,
  );
}

function ParamGroup({
  label,
  params,
  spec,
}: {
  label: string;
  params: Parameter[];
  spec: OpenAPISpec;
}) {
  const expandedParams = expandParameters(params, spec);
  if (expandedParams.length === 0) return null;

  return (
    <div className="space-y-0 overflow-hidden rounded-md border border-border">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-3 py-1.5 sm:px-4">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <CopyButton
          value={parameterCopyValue(expandedParams)}
          label={expandedParams[0]?.in === "query" ? "Query" : "JSON"}
          className="ml-auto"
        />
      </div>
      {expandedParams.map((p, i) => (
        <div
          key={`${p.in}-${p.name}`}
          className={`px-3 py-3 sm:px-4 ${i < expandedParams.length - 1 ? "border-b border-border/60" : ""}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold">{p.name}</span>
            {p.required && (
              <span className="font-mono text-[10px] font-semibold text-destructive">required</span>
            )}
            {p.schema?.type && (
              <span className="font-mono text-xs text-muted-foreground">
                {Array.isArray(p.schema.type) ? p.schema.type.join(" | ") : p.schema.type}
                {p.schema.format ? ` <${p.schema.format}>` : ""}
              </span>
            )}
            {p.schema?.enum && (
              <span className="font-mono text-xs text-muted-foreground/70">
                ({p.schema.enum.map(String).join(" | ")})
              </span>
            )}
            {p.schema?.default !== undefined && (
              <span className="ml-auto font-mono text-[10px] text-muted-foreground/60">
                default: {JSON.stringify(p.schema.default)}
              </span>
            )}
          </div>
          {p.description && (
            <div className="mt-1 text-xs text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-foreground [&_p]:inline">
              <Markdown>{p.description}</Markdown>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ResponsePanel({
  status,
  response,
  spec,
  defaultOpen,
}: {
  status: string;
  response: ResponseObject;
  spec: OpenAPISpec;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const schemas = schemaEntries(response.content);
  const hasSchema = schemas.length > 0;

  if (!hasSchema) {
    return (
      <div className="overflow-hidden rounded-md border border-border">
        <div className="flex w-full items-center gap-3 px-3 py-3 text-left sm:px-4">
          <Badge variant={statusVariant(status)} className="font-mono">
            {status}
          </Badge>
          {response.description && (
            <span className="flex-1 text-sm text-muted-foreground">{response.description}</span>
          )}
          <span className="ml-auto shrink-0 font-mono text-[10px] uppercase text-muted-foreground/60">
            No body
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-border">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/40 sm:px-4"
      >
        <Badge variant={statusVariant(status)} className="font-mono">
          {status}
        </Badge>
        {response.description && (
          <span className="flex-1 text-sm text-muted-foreground">{response.description}</span>
        )}
        {open ? (
          <ChevronDownIcon className="ml-auto size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRightIcon className="ml-auto size-4 shrink-0 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="space-y-3 border-t border-border px-3 py-3 sm:px-4">
          {schemas.map(([contentType, { schema }]) => (
            <SchemaView key={contentType} spec={spec} schema={schema} title={contentType} />
          ))}
        </div>
      )}
    </div>
  );
}

export function EndpointDetail({ spec, op, apiUrl }: Props) {
  const { method, path, operation } = op;
  const params = operation.parameters ?? [];
  const pathParams = expandParameters(
    params.filter((p) => p.in === "path"),
    spec,
  );
  const queryParams = expandParameters(
    params.filter((p) => p.in === "query"),
    spec,
  );
  const headerParams = expandParameters(
    params.filter((p) => p.in === "header"),
    spec,
  );
  const requestBodySchemas = schemaEntries(operation.requestBody?.content);
  const tryItRequestBody = requestBodyForTryIt(operation.requestBody?.content);
  const requiresAuth = operationRequiresAuth(spec, operation);

  return (
    <div className="max-w-3xl space-y-5 sm:space-y-6">
      <div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <MethodBadge method={method} />
          <code className="min-w-0 break-all font-mono text-sm font-medium sm:text-lg">
            {path}
          </code>
          <Badge variant={requiresAuth ? "outline" : "secondary"}>
            {requiresAuth ? "Auth required" : "Public"}
          </Badge>
        </div>
        {operation.summary && (
          <h2 className="mt-2 text-lg font-semibold sm:text-xl">{operation.summary}</h2>
        )}
        {operation.description && (
          <div className="prose prose-sm dark:prose-invert mt-2 max-w-none text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_code]:text-foreground">
            <Markdown>{operation.description}</Markdown>
          </div>
        )}
      </div>

      <Tabs defaultValue="details">
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="try">Try it out</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4 space-y-5">
          {(pathParams.length > 0 || queryParams.length > 0 || headerParams.length > 0) && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Parameters</h3>
              <div className="space-y-2">
                <ParamGroup label="Path" params={pathParams} spec={spec} />
                <ParamGroup label="Query" params={queryParams} spec={spec} />
                <ParamGroup label="Headers" params={headerParams} spec={spec} />
              </div>
            </div>
          )}

          {requestBodySchemas.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">Request Body</h3>
                {operation.requestBody?.required && (
                  <span className="text-xs font-medium text-destructive">required</span>
                )}
              </div>
              {operation.requestBody?.description && (
                <div className="text-sm text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs [&_code]:text-foreground">
                  <Markdown>{operation.requestBody.description}</Markdown>
                </div>
              )}
              <div className="space-y-3">
                {requestBodySchemas.map(([contentType, { schema }]) => (
                  <SchemaView key={contentType} spec={spec} schema={schema} title={contentType} />
                ))}
              </div>
            </div>
          )}

          {operation.responses && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Responses</h3>
              <div className="space-y-2">
                {Object.entries(operation.responses).map(([status, response]) => (
                  <ResponsePanel
                    key={status}
                    status={status}
                    response={response}
                    spec={spec}
                    defaultOpen={status.startsWith("2")}
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="try" className="mt-4">
          <EndpointTryIt
            key={`${method}-${path}`}
            method={method}
            path={path}
            operation={operation}
            apiUrl={apiUrl}
            spec={spec}
            requiresAuth={requiresAuth}
            requestBodyContentType={tryItRequestBody?.contentType}
            requestBodyMedia={tryItRequestBody?.media}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
