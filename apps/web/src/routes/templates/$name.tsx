import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { TemplateDetailView } from "@/components/template-detail-view";
import { useSession } from "@/lib/auth-client";
import { templateDetailQuery } from "@/lib/api";
import { absoluteUrl, pageMeta, templateWebPath } from "@/lib/site-metadata";
import { runtimeConfigFromContext, useRuntimeConfig } from "@/lib/runtime-config";

export const Route = createFileRoute("/templates/$name")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      templateDetailQuery(runtimeConfigFromContext(context), params.name),
    ),
  head: ({ loaderData }) => ({
    ...pageMeta({
      title: `${loaderData?.title ?? "LaTeX Template"} - LaTeX Template | Loadclass`,
      description:
        loaderData?.description ??
        "Download and inspect this LaTeX template package on Loadclass.",
      path: loaderData ? templateWebPath(loaderData.name) : "/templates",
      image: loaderData?.thumbnailUrl,
      type: "article",
      jsonLd: loaderData
        ? {
            "@context": "https://schema.org",
            "@type": "CreativeWork",
            name: loaderData.title,
            alternateName: loaderData.name,
            description: loaderData.description,
            url: absoluteUrl(templateWebPath(loaderData.name)),
            image: loaderData.thumbnailUrl ?? absoluteUrl("/og-image.png"),
            license: loaderData.license,
            isAccessibleForFree: true,
            datePublished: loaderData.createdAt,
            dateModified: loaderData.updatedAt,
            keywords: ["LaTeX", "LaTeX template", loaderData.category],
          }
        : undefined,
    }),
  }),
  errorComponent: ({ error }) => (
    <div className="flex min-h-svh items-center justify-center text-center">
      <div>
        <p className="font-medium text-foreground">
          {error instanceof Error && error.message === "Template not found"
            ? "Template not found"
            : "Could not load template"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {error instanceof Error && error.message === "Template not found"
            ? "This template doesn't exist on this registry."
            : "Make sure the API is running."}
        </p>
        <Link to="/templates" className="mt-3 block text-sm text-primary hover:underline">
          Back to browse
        </Link>
      </div>
    </div>
  ),
  component: TemplateDetailPage,
});

function TemplateDetailPage() {
  const { name } = Route.useParams();
  const runtimeConfig = useRuntimeConfig();
  const { data: tmpl } = useSuspenseQuery(templateDetailQuery(runtimeConfig, name));
  const { data: session } = useSession();
  const navigate = Route.useNavigate();

  return (
    <TemplateDetailView
      tmpl={tmpl}
      session={session}
      onLoginRequired={() => navigate({ to: "/login" })}
    />
  );
}
