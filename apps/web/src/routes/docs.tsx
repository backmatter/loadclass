import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppNav } from "@/components/app-nav";
import { BrandLogo } from "@/components/brand-logo";
import { EndpointDetail } from "@/components/api-docs/endpoint-detail";
import { MethodBadge } from "@/components/api-docs/method-badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SchemaView } from "@/components/api-docs/schema-view";
import { CopyButton } from "@/components/api-docs/copy-button";
import {
  collectSchemas,
  groupOperationsByTag,
  operationItems,
  operationKey,
} from "@/components/api-docs/openapi-navigation";
import type { OpenAPISpec } from "@/lib/openapi-types";
import { openApiSpecQuery } from "@/lib/api";
import { useDocsUiStore } from "@/lib/ui-store";
import { pageMeta } from "@/lib/site-metadata";
import { useRuntimeConfig } from "@/lib/runtime-config";

const OVERVIEW_VALUE = "__overview__";

export const Route = createFileRoute("/docs")({
  head: () =>
    pageMeta({
      title: "Loadclass API Docs",
      description:
        "API reference for browsing, publishing, downloading, and managing LaTeX templates with Loadclass.",
      path: "/docs",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        headline: "Loadclass API Docs",
        description:
          "API reference for browsing, publishing, downloading, and managing LaTeX templates with Loadclass.",
      },
    }),
  component: DocsPage,
});

function DocsPage() {
  const runtimeConfig = useRuntimeConfig();
  const { data: spec, error, isLoading, refetch } = useQuery(openApiSpecQuery(runtimeConfig));
  const selected = useDocsUiStore((state) => state.selectedOperation);
  const setSelected = useDocsUiStore((state) => state.setSelectedOperation);
  const errorMessage = error instanceof Error ? error.message : "Failed to load";

  if (error) {
    return (
      <div className="flex h-svh flex-col bg-background">
        <AppNav activePath="docs" />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="font-medium">Could not load API spec</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Make sure the API is running on{" "}
              <code className="font-mono text-xs">{runtimeConfig.apiUrl}</code>.
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground/60">{errorMessage}</p>
            <Button className="mt-4" variant="outline" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || !spec) {
    return (
      <div className="flex h-svh flex-col bg-background">
        <AppNav activePath="docs" />
        <div className="flex flex-1 items-center justify-center">
          <p className="animate-pulse text-sm text-muted-foreground">Loading API spec…</p>
        </div>
      </div>
    );
  }

  const groups = groupOperationsByTag(spec);
  const operations = operationItems(groups);
  const selectedValue = selected ? operationKey(selected.method, selected.path) : OVERVIEW_VALUE;

  function selectOperation(value: string | null) {
    if (!value) return;
    if (value === OVERVIEW_VALUE) {
      setSelected(null);
      return;
    }

    const op = operations.find((item) => operationKey(item.method, item.path) === value);
    if (op) {
      setSelected({ method: op.method, path: op.path, operation: op.operation });
    }
  }

  return (
    <div className="flex h-svh flex-col bg-background">
      <AppNav activePath="docs" />
      <SidebarProvider className="min-h-0 flex-1 overflow-hidden">
        <div className="hidden lg:block">
          <Sidebar collapsible="none" className="border-r">
            <SidebarHeader className="px-4 py-3">
              <button
                onClick={() => setSelected(null)}
                className="flex flex-col items-start gap-1 text-left transition-opacity hover:opacity-70"
                aria-label="API overview"
              >
                <BrandLogo variant="wordmark" imgClassName="h-6 w-auto max-w-[150px]" />
                <p className="pl-2 font-mono text-[11px] text-sidebar-foreground/50">
                  API v{spec.info.version}
                </p>
              </button>
            </SidebarHeader>

            <SidebarSeparator />

            <SidebarContent>
              {Array.from(groups.entries()).map(([tag, ops]) => (
                <SidebarGroup key={tag}>
                  <SidebarGroupLabel className="uppercase tracking-wider">{tag}</SidebarGroupLabel>
                  <SidebarMenu>
                    {ops.map(({ method, path, operation }) => {
                      const isSelected = selected?.method === method && selected?.path === path;
                      return (
                        <SidebarMenuItem key={`${method}-${path}`}>
                          <SidebarMenuButton
                            isActive={isSelected}
                            onClick={() => setSelected({ method, path, operation })}
                            className="grid h-auto grid-cols-[2.75rem_minmax(0,1fr)] py-1.5"
                          >
                            <MethodBadge method={method} size="xs" />
                            <span className="truncate font-mono text-[11px]">{path}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroup>
              ))}
            </SidebarContent>
          </Sidebar>
        </div>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mb-4 space-y-3 lg:hidden">
            <div className="flex items-end justify-between gap-3">
              <button
                onClick={() => setSelected(null)}
                className="min-w-0 text-left"
                aria-label="API overview"
              >
                <BrandLogo variant="wordmark" imgClassName="h-6 w-auto max-w-[140px]" />
                <p className="mt-0.5 pl-2 font-mono text-[11px] text-muted-foreground">
                  API v{spec.info.version}
                </p>
              </button>
            </div>

            <Select value={selectedValue} onValueChange={selectOperation}>
              <SelectTrigger className="h-auto min-h-8 w-full py-2">
                <SelectValue>
                  {selected
                    ? `${selected.method.toUpperCase()} ${selected.path}`
                    : "API overview"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="start" alignItemWithTrigger={false} className="max-w-[92vw]">
                <SelectItem value={OVERVIEW_VALUE}>API overview</SelectItem>
                {Array.from(groups.entries()).map(([tag, ops]) => (
                  <SelectGroup key={tag}>
                    <SelectLabel className="uppercase tracking-wider">{tag}</SelectLabel>
                    {ops.map(({ method, path }) => (
                      <SelectItem key={`${method}-${path}`} value={operationKey(method, path)}>
                        <MethodBadge method={method} size="xs" />
                        <span className="truncate font-mono">{path}</span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selected ? (
            <EndpointDetail spec={spec} op={selected} apiUrl={runtimeConfig.apiUrl} />
          ) : (
            <ApiOverview spec={spec} apiUrl={runtimeConfig.apiUrl} />
          )}
        </main>
      </SidebarProvider>
    </div>
  );
}

function ApiOverview({ spec, apiUrl }: { spec: OpenAPISpec; apiUrl: string }) {
  const schemas = collectSchemas(spec);
  const openApiUrl = `${apiUrl}/openapi.json`;
  const baseUrl = spec.servers?.[0]?.url ?? apiUrl;
  const generateClientSnippet = `npm install openapi-fetch
npx openapi-typescript@latest ${openApiUrl} -o loadclass-api.ts`;
  const typedClientSnippet = `import createClient from "openapi-fetch";
import type { paths } from "./loadclass-api";

const client = createClient<paths>({
  baseUrl: "${baseUrl}",
});`;

  return (
    <div className="max-w-4xl space-y-6 sm:space-y-8">
      <div className="space-y-0">
        <h1 className="text-xl font-bold sm:text-2xl">Registry API</h1>
        <p className="font-mono text-sm text-muted-foreground">v{spec.info.version}</p>
      </div>

      {spec.info.description && (
        <p className="text-sm text-muted-foreground sm:text-base">{spec.info.description}</p>
      )}

      {spec.servers?.[0] && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Base URL
          </p>
          <code className="block overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs sm:text-sm">
            {spec.servers[0].url}
          </code>
          {spec.servers[0].description && (
            <p className="mt-1 text-xs text-muted-foreground">{spec.servers[0].description}</p>
          )}
        </div>
      )}

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Import into a project
        </p>
        <div className="rounded-md border bg-card p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className="mr-auto text-sm font-medium">OpenAPI document</p>
            <CopyButton value={openApiUrl} label="URL" />
          </div>
          <code className="block overflow-x-auto rounded bg-muted px-2 py-1.5 font-mono text-xs">
            {openApiUrl}
          </code>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-md border bg-card p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="mr-auto text-sm font-medium">Generate types</p>
              <CopyButton value={generateClientSnippet} />
            </div>
            <pre className="overflow-x-auto rounded bg-muted p-2 font-mono text-xs">
              {generateClientSnippet}
            </pre>
          </div>
          <div className="rounded-md border bg-card p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="mr-auto text-sm font-medium">Create a typed client</p>
              <CopyButton value={typedClientSnippet} />
            </div>
            <pre className="overflow-x-auto rounded bg-muted p-2 font-mono text-xs">
              {typedClientSnippet}
            </pre>
          </div>
        </div>
      </div>

      {schemas.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Models
          </p>
          <div className="space-y-3">
            {schemas.map(({ name, schema }) => (
              <SchemaView key={name} spec={spec} schema={schema} title={name} />
            ))}
          </div>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Select an endpoint from the sidebar to view details and try it out.
      </p>
    </div>
  );
}
