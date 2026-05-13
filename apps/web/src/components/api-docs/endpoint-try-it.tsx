import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { MediaTypeObject, OpenAPISpec, Operation } from "@/lib/openapi-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useSession } from "@/lib/auth-client";
import { CopyButton } from "./copy-button";
import {
  buildEndpointRequest,
  describeEndpointRequest,
} from "./endpoint-request";

interface Props {
  method: string;
  path: string;
  operation: Operation;
  apiUrl: string;
  spec: OpenAPISpec;
  requiresAuth: boolean;
  requestBodyContentType?: string;
  requestBodyMedia?: MediaTypeObject;
}

function statusVariant(status: number): "default" | "secondary" | "destructive" {
  if (status < 300) return "default";
  if (status < 400) return "secondary";
  return "destructive";
}

export function EndpointTryIt({
  method,
  path,
  operation,
  apiUrl,
  spec,
  requiresAuth,
  requestBodyContentType,
  requestBodyMedia,
}: Props) {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;

  const descriptor = useMemo(
    () =>
      describeEndpointRequest({
        spec,
        operation,
        method,
        requestBodyContentType,
        requestBodyMedia,
      }),
    [spec, operation, method, requestBodyContentType, requestBodyMedia],
  );

  const [pathValues, setPathValues] = useState<Record<string, string>>({});
  const [queryValues, setQueryValues] = useState<Record<string, string>>({});
  const [headerValues, setHeaderValues] = useState<Record<string, string>>({});
  const [bearerToken, setBearerToken] = useState("");
  const [body, setBody] = useState(() => descriptor.initialBody);
  const [multipartValues, setMultipartValues] = useState<Record<string, string>>(
    () => descriptor.initialMultipartValues,
  );
  const [multipartFiles, setMultipartFiles] = useState<Record<string, File | null>>({});
  const [response, setResponse] = useState<{ status: number; body: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = buildEndpointRequest({
    descriptor,
    apiUrl,
    path,
    method,
    requiresAuth,
    requestBodyContentType,
    inputs: {
      pathValues,
      queryValues,
      headerValues,
      bearerToken,
      body,
      multipartValues,
      multipartFiles,
    },
  });

  async function send() {
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      const res = await fetch(request.url, {
        method: method.toUpperCase(),
        headers: request.headers,
        credentials: requiresAuth ? "include" : "same-origin",
        body: request.requestBody,
      });

      const text = await res.text();
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        /* not JSON */
      }
      setResponse({ status: res.status, body: pretty });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {requiresAuth && (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Authorization
          </Label>
          {isAuthenticated ? (
            <p className="text-xs text-muted-foreground">
              Signed in as <span className="font-medium">{session.user.email}</span>. Leave the API
              key blank to use your session, or paste a bearer key.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              This endpoint requires authentication. Paste a bearer API key, or{" "}
              <Link to="/login" className="text-primary underline-offset-2 hover:underline">
                sign in
              </Link>{" "}
              to use your browser session.
            </p>
          )}
          <div className="flex min-w-0">
            <span className="flex items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-xs text-muted-foreground">
              Bearer
            </span>
            <Input
              className="rounded-l-none font-mono text-xs"
              placeholder="lc_…"
              value={bearerToken}
              onChange={(e) => setBearerToken(e.target.value)}
            />
          </div>
        </div>
      )}

      {descriptor.pathParams.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Path Parameters
          </Label>
          <div className="space-y-2">
            {descriptor.pathParams.map((p) => (
              <div key={p.name} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                <span className="shrink-0 font-mono text-xs text-muted-foreground sm:w-28 sm:text-sm sm:text-foreground">
                  {p.name}
                </span>
                <Input
                  className="font-mono text-sm"
                  placeholder={p.description ?? p.name}
                  value={pathValues[p.name] ?? ""}
                  onChange={(e) => setPathValues((v) => ({ ...v, [p.name]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {descriptor.queryParams.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Query Parameters
          </Label>
          <div className="space-y-2">
            {descriptor.queryParams.map((p) => (
              <div key={p.name} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                <span className="shrink-0 font-mono text-xs text-muted-foreground sm:w-28 sm:text-sm sm:text-foreground">
                  {p.name}
                </span>
                <Input
                  className="font-mono text-sm"
                  placeholder={
                    p.schema?.default !== undefined
                      ? String(p.schema.default)
                      : (p.description ?? p.name)
                  }
                  value={queryValues[p.name] ?? ""}
                  onChange={(e) => setQueryValues((v) => ({ ...v, [p.name]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {descriptor.headerParams.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Headers
          </Label>
          <div className="space-y-2">
            {descriptor.headerParams.map((p) => (
              <div key={p.name} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                <span className="shrink-0 font-mono text-xs text-muted-foreground sm:w-28 sm:text-sm sm:text-foreground">
                  {p.name}
                </span>
                <Input
                  className="font-mono text-sm"
                  placeholder={p.description ?? p.name}
                  value={headerValues[p.name] ?? ""}
                  onChange={(e) => setHeaderValues((v) => ({ ...v, [p.name]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {descriptor.bodyKind === "json" && (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Request Body
          </Label>
          <Textarea
            className="font-mono text-xs"
            rows={8}
            placeholder='{"key": "value"}'
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
      )}

      {descriptor.bodyKind === "multipart" && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Form Data
          </Label>
          <div className="space-y-3 rounded-md border border-border p-3">
            {descriptor.fields.map((field) => (
              <div key={field.name} className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Label className="font-mono text-xs">{field.name}</Label>
                  {field.required && (
                    <span className="font-mono text-[10px] font-semibold text-destructive">
                      required
                    </span>
                  )}
                  {field.contentType && (
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                      {field.contentType}
                    </span>
                  )}
                </div>
                {field.binary ? (
                  <Input
                    type="file"
                    accept={field.name === "archive" ? ".tar.gz,.tgz" : undefined}
                    onChange={(e) =>
                      setMultipartFiles((current) => ({
                        ...current,
                        [field.name]: e.target.files?.[0] ?? null,
                      }))
                    }
                  />
                ) : (
                  <Textarea
                    className="font-mono text-xs"
                    rows={field.name === "manifest" ? 8 : 3}
                    value={multipartValues[field.name] ?? ""}
                    onChange={(e) =>
                      setMultipartValues((current) => ({
                        ...current,
                        [field.name]: e.target.value,
                      }))
                    }
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="min-w-0 space-y-2 rounded-md border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-auto text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Copy Request
          </p>
          <CopyButton value={request.snippets.url} label="URL" />
          <CopyButton value={request.snippets.curl} label="cURL" />
          <CopyButton value={request.snippets.fetch} label="fetch" />
        </div>
        <code className="block overflow-x-auto rounded bg-muted px-2 py-1.5 font-mono text-xs">
          {request.url}
        </code>
      </div>

      <Button onClick={send} disabled={loading} className="w-full">
        {loading ? "Sending…" : "Send request"}
      </Button>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {response && (
        <div className="space-y-3">
          <Separator />
          <div className="flex items-center gap-2">
            <Badge variant={statusVariant(response.status)} className="font-mono">
              {response.status}
            </Badge>
            <span className="text-sm text-muted-foreground">Response</span>
          </div>
          <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 font-mono text-xs text-foreground">
            {response.body || "(empty)"}
          </pre>
        </div>
      )}
    </div>
  );
}
