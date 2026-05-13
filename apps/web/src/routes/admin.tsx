import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAdminSession, useSession } from "@/lib/auth-client";
import { AppNav } from "@/components/app-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  adminOrgsQuery,
  adminTemplatesQuery,
  removeOrganizationVerification,
  removeTemplateVerification,
  setOrganizationVerification,
  setTemplateVerification,
} from "@/lib/api";
import { requireAdminSession } from "@/lib/auth-guards";
import { useAdminUiStore } from "@/lib/ui-store";
import { privatePageMeta } from "@/lib/site-metadata";
import { runtimeConfigFromContext, useRuntimeConfig } from "@/lib/runtime-config";

export const Route = createFileRoute("/admin")({
  beforeLoad: ({ context }) => requireAdminSession(context.queryClient, runtimeConfigFromContext(context)),
  head: () => privatePageMeta("Admin - Loadclass", "/admin"),
  component: AdminPage,
});

function AdminPage() {
  const { data: session, isPending } = useSession();
  const isAdmin = isAdminSession(session);

  if (isPending || !session) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <p className="animate-pulse text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-svh bg-background">
      <AppNav />
      <main className="mx-auto max-w-7xl space-y-8 px-10 py-10">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin panel</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage templates and organizations.</p>
        </div>
        <AdminTemplatesSection />
        <AdminOrgsSection />
      </main>
    </div>
  );
}

function AdminTemplatesSection() {
  const q = useAdminUiStore((state) => state.templateFilter);
  const setQ = useAdminUiStore((state) => state.setTemplateFilter);
  const queryClient = useQueryClient();
  const runtimeConfig = useRuntimeConfig();
  const templatesQuery = adminTemplatesQuery(runtimeConfig);
  const { data, isLoading } = useQuery(templatesQuery);
  const allTemplates = data?.templates ?? [];

  const verifyMutation = useMutation({
    mutationFn: (tmpl: (typeof allTemplates)[number]) =>
      tmpl.isTemplateVerified
        ? removeTemplateVerification(runtimeConfig, tmpl.name)
        : setTemplateVerification(runtimeConfig, tmpl.name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: templatesQuery.queryKey }),
  });

  const templates = allTemplates.filter(
    (t) =>
      !q ||
      t.name.toLowerCase().includes(q.toLowerCase()) ||
      t.description.toLowerCase().includes(q.toLowerCase()),
  );

  function toggleVerify(tmpl: (typeof allTemplates)[number]) {
    verifyMutation.mutate(tmpl);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Templates ({allTemplates.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Filter by name or description…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="text-sm"
        />
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No templates found.</p>
        ) : (
          <div className="space-y-1.5">
            {templates.map((tmpl) => (
              <div
                key={tmpl.id}
                className="flex items-center justify-between rounded-md border border-border px-4 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      to="/templates/$name"
                      params={{ name: tmpl.name }}
                      className="font-mono text-sm font-medium hover:text-primary hover:underline"
                    >
                      {tmpl.name}
                    </Link>
                    {tmpl.isVerified && (
                      <Badge variant="secondary" className="text-[10px]">
                        {tmpl.isTemplateVerified ? "verified" : "org verified"}
                      </Badge>
                    )}
                    {tmpl.isDeprecated && (
                      <Badge variant="destructive" className="text-[10px]">
                        deprecated
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                    {tmpl.description}
                  </p>
                </div>
                <div className="ml-4 flex shrink-0 items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    ↓ {tmpl.downloadCount.toLocaleString()}
                  </span>
                  <Button
                    size="sm"
                    variant={tmpl.isTemplateVerified ? "outline" : "default"}
                    disabled={verifyMutation.isPending && verifyMutation.variables?.id === tmpl.id}
                    onClick={() => toggleVerify(tmpl)}
                  >
                    {tmpl.isTemplateVerified ? "Unverify" : "Verify"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AdminOrgsSection() {
  const q = useAdminUiStore((state) => state.orgFilter);
  const setQ = useAdminUiStore((state) => state.setOrgFilter);
  const queryClient = useQueryClient();
  const runtimeConfig = useRuntimeConfig();
  const orgsQuery = adminOrgsQuery(runtimeConfig);
  const { data, isLoading } = useQuery(orgsQuery);
  const allOrgs = data?.orgs ?? [];

  const verifyMutation = useMutation({
    mutationFn: (org: (typeof allOrgs)[number]) =>
      org.isVerified
        ? removeOrganizationVerification(runtimeConfig, org.slug)
        : setOrganizationVerification(runtimeConfig, org.slug),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orgsQuery.queryKey }),
  });

  const orgs = allOrgs.filter(
    (o) =>
      !q ||
      o.name.toLowerCase().includes(q.toLowerCase()) ||
      o.slug.toLowerCase().includes(q.toLowerCase()),
  );

  function toggleVerify(org: (typeof allOrgs)[number]) {
    verifyMutation.mutate(org);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organizations ({allOrgs.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Filter by name or slug…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="text-sm"
        />
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : orgs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No organizations found.</p>
        ) : (
          <div className="space-y-1.5">
            {orgs.map((org) => (
              <div
                key={org.id}
                className="flex items-center justify-between rounded-md border border-border px-4 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      to="/orgs/$slug"
                      params={{ slug: org.slug }}
                      className="text-sm font-medium hover:text-primary hover:underline"
                    >
                      {org.name}
                    </Link>
                    {org.isVerified && (
                      <Badge variant="secondary" className="text-[10px]">
                        verified
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">@{org.slug}</p>
                </div>
                <div className="ml-4 shrink-0">
                  <Button
                    size="sm"
                    variant={org.isVerified ? "outline" : "default"}
                    disabled={verifyMutation.isPending && verifyMutation.variables?.id === org.id}
                    onClick={() => toggleVerify(org)}
                  >
                    {org.isVerified ? "Unverify" : "Verify"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
