import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppNav } from "@/components/app-nav";
import { TemplateSummaryRow } from "@/components/template-summary-row";
import { userProfileQuery } from "@/lib/api";
import { pageMeta } from "@/lib/site-metadata";
import { runtimeConfigFromContext, useRuntimeConfig } from "@/lib/runtime-config";

export const Route = createFileRoute("/users/$id")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(userProfileQuery(runtimeConfigFromContext(context), params.id)),
  head: ({ loaderData, params }) =>
    pageMeta({
      title: `${loaderData?.name ?? "User"} - Loadclass`,
      description: `Templates published by ${loaderData?.name ?? "this Loadclass user"}.`,
      path: `/users/${encodeURIComponent(params.id)}`,
      type: "profile",
    }),
  errorComponent: ({ error }) => (
    <div className="flex min-h-svh items-center justify-center text-center">
      <div>
        <p className="font-medium text-foreground">
          {error instanceof Error && error.message === "User not found"
            ? "User not found"
            : "Could not load profile"}
        </p>
        <Link to="/templates" className="mt-3 block text-sm text-primary hover:underline">
          Back to browse
        </Link>
      </div>
    </div>
  ),
  component: UserProfilePage,
});

function UserProfilePage() {
  const { id } = Route.useParams();
  const runtimeConfig = useRuntimeConfig();
  const { data: profile } = useSuspenseQuery(userProfileQuery(runtimeConfig, id));

  return (
    <div className="min-h-svh bg-background">
      <AppNav />
      <main className="mx-auto max-w-7xl px-10 py-10">
        <div className="mb-8 flex items-center gap-4">
          {profile.image && (
            <img
              src={profile.image}
              alt={profile.name}
              className="size-16 rounded-full object-cover"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold text-foreground">{profile.name}</h1>
            <p className="text-sm text-muted-foreground">
              Member since {new Date(profile.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Templates ({profile.templates.length})
        </h2>

        {profile.templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No templates published yet.</p>
        ) : (
          <div className="space-y-2">
            {profile.templates.map((tmpl) => (
              <TemplateSummaryRow key={tmpl.id} template={tmpl} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
