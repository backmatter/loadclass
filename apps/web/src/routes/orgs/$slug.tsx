import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { AppNav } from "@/components/app-nav";
import { TemplateSummaryRow } from "@/components/template-summary-row";
import { organizationProfileQuery } from "@/lib/api";
import { pageMeta } from "@/lib/site-metadata";
import { runtimeConfigFromContext, useRuntimeConfig } from "@/lib/runtime-config";

export const Route = createFileRoute("/orgs/$slug")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      organizationProfileQuery(runtimeConfigFromContext(context), params.slug),
    ),
  head: ({ loaderData, params }) =>
    pageMeta({
      title: `${loaderData?.name ?? "Organization"} - Loadclass`,
      description: `LaTeX templates published by ${loaderData?.name ?? "this Loadclass organization"}.`,
      path: `/orgs/${encodeURIComponent(params.slug)}`,
      type: "profile",
    }),
  errorComponent: ({ error }) => (
    <div className="flex min-h-svh items-center justify-center text-center">
      <div>
        <p className="font-medium text-foreground">
          {error instanceof Error && error.message === "Organization not found"
            ? "Organization not found"
            : "Could not load organization"}
        </p>
        <Link to="/templates" className="mt-3 block text-sm text-primary hover:underline">
          Back to browse
        </Link>
      </div>
    </div>
  ),
  component: OrgProfilePage,
});

function OrgProfilePage() {
  const { slug } = Route.useParams();
  const runtimeConfig = useRuntimeConfig();
  const { data: org } = useSuspenseQuery(organizationProfileQuery(runtimeConfig, slug));

  return (
    <div className="min-h-svh bg-background">
      <AppNav />
      <main className="mx-auto max-w-7xl px-10 py-10">
        <div className="mb-8 flex items-center gap-4">
          {org.logo && (
            <img src={org.logo} alt={org.name} className="size-16 rounded-full object-cover" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{org.name}</h1>
              {org.isVerified && <Badge variant="secondary">verified</Badge>}
            </div>
            <p className="font-mono text-sm text-muted-foreground">@{org.slug}</p>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Members ({org.members.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {org.members.map((m) => (
              <Link
                key={m.id}
                to="/users/$id"
                params={{ id: m.id }}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:border-primary"
              >
                {m.image && (
                  <img src={m.image} alt={m.name} className="size-5 rounded-full object-cover" />
                )}
                <span>{m.name}</span>
                {m.role === "owner" && (
                  <Badge variant="outline" className="text-[10px]">
                    owner
                  </Badge>
                )}
              </Link>
            ))}
          </div>
        </div>

        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Templates ({org.templates.length})
        </h2>

        {org.templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No templates published yet.</p>
        ) : (
          <div className="space-y-2">
            {org.templates.map((tmpl) => (
              <TemplateSummaryRow key={tmpl.id} template={tmpl} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
