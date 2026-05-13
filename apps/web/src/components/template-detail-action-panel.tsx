import { Link } from "@tanstack/react-router";
import { StarIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { TemplateDetail } from "@/lib/api";
import { isAdminSession, type AuthSession } from "@/lib/auth-client";
import { useTemplateDetailWorkflowContext } from "@/lib/template-detail-workflow";
import { cn } from "@/lib/utils";

interface TemplateDetailActionPanelProps {
  layout: "mobile" | "sidebar";
  session: AuthSession | null | undefined;
  onLoginRequired: () => void;
}

export function TemplateDetailActionPanel({
  layout,
  session,
  onLoginRequired,
}: TemplateDetailActionPanelProps) {
  const { tmpl } = useTemplateDetailWorkflowContext();
  const canManage = tmpl.canManage;
  const isAdmin = isAdminSession(session);

  if (layout === "mobile") {
    return (
      <div className="mt-4 rounded-md border border-border bg-card p-3 lg:hidden">
        <PrimaryActions mobile session={session} onLoginRequired={onLoginRequired} />

        <div className="mt-3 grid grid-cols-3 gap-3 border-t border-border pt-3 text-xs">
          <div>
            <p className="text-muted-foreground">Version</p>
            <p className="mt-0.5 font-mono text-foreground">{tmpl.latestVersion ?? "-"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Category</p>
            <p className="mt-0.5 truncate text-foreground">{tmpl.category}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Downloads</p>
            <p className="mt-0.5 text-foreground">{tmpl.downloadCount.toLocaleString()}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <aside className="hidden w-full shrink-0 space-y-4 lg:block lg:w-64">
      <Card className="p-0">
        <CardContent className="space-y-4 p-5">
          <PrimaryActions session={session} onLoginRequired={onLoginRequired} />
          <Separator />
          <StatsGrid tmpl={tmpl} />
          <Separator />
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Category</p>
            <Badge variant="secondary">{tmpl.category}</Badge>
          </div>
          <Publisher tmpl={tmpl} />
          <Separator />
          <TemplateMetadata tmpl={tmpl} />
          <ExternalLinks tmpl={tmpl} />
          {canManage && <OwnerActions />}
          {isAdmin && tmpl.isLocal && <AdminActions />}
        </CardContent>
      </Card>
    </aside>
  );
}

function PrimaryActions({
  mobile,
  session,
  onLoginRequired,
}: {
  mobile?: boolean;
  session: AuthSession | null | undefined;
  onLoginRequired: () => void;
}) {
  const {
    tmpl,
    canDownloadLatest,
    canStar,
    downloadError,
    downloading,
    templateProjectUrl,
    starMutation,
    downloadLatest,
  } = useTemplateDetailWorkflowContext();

  function toggleStar() {
    if (!session) {
      onLoginRequired();
      return;
    }
    if (!canStar) return;
    starMutation.mutate();
  }

  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)_72px] gap-2">
        <Button
          className="w-full"
          size="sm"
          onClick={() => void downloadLatest()}
          disabled={downloading || !canDownloadLatest}
        >
          {downloading ? "Preparing..." : "Download"}
        </Button>
        {tmpl.isLocal && (
          <Button
            type="button"
            variant={tmpl.isStarred ? "secondary" : "outline"}
            size="sm"
            className="w-full"
            onClick={toggleStar}
            disabled={starMutation.isPending}
            title={tmpl.isStarred ? "Unstar template" : "Star template"}
          >
            <StarIcon className={cn("size-3.5", tmpl.isStarred && "fill-current")} />
            {tmpl.starCount.toLocaleString()}
          </Button>
        )}
        {downloadError && (
          <p className="col-span-2 mt-1 text-xs text-destructive">{downloadError}</p>
        )}
      </div>
      {templateProjectUrl && (
        <Button
          nativeButton={false}
          render={<a href={templateProjectUrl} />}
          variant="outline"
          size="sm"
          className={cn("w-full", mobile && "col-span-2 mt-2")}
        >
          Create project from template
        </Button>
      )}
    </>
  );
}

function StatsGrid({ tmpl }: { tmpl: TemplateDetail }) {
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div>
        <p className="text-xs text-muted-foreground">Downloads</p>
        <p className="mt-0.5 font-medium">{tmpl.downloadCount.toLocaleString()}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Weekly</p>
        <p className="mt-0.5 font-medium">{tmpl.weeklyDownloads.toLocaleString()}</p>
      </div>
    </div>
  );
}

function Publisher({ tmpl }: { tmpl: TemplateDetail }) {
  if (!tmpl.owner) return null;

  return (
    <>
      <Separator />
      <div>
        <p className="mb-1.5 text-xs text-muted-foreground">Publisher</p>
        {tmpl.owner.type === "user" ? (
          <Link
            to="/users/$id"
            params={{ id: tmpl.owner.id }}
            className="flex items-center gap-2 text-sm text-foreground hover:text-primary hover:underline"
          >
            {tmpl.owner.image && (
              <img src={tmpl.owner.image} alt="" className="size-5 rounded-full object-cover" />
            )}
            {tmpl.owner.name}
          </Link>
        ) : (
          <Link
            to="/orgs/$slug"
            params={{ slug: tmpl.owner.slug }}
            className="flex items-center gap-2 text-sm text-foreground hover:text-primary hover:underline"
          >
            {tmpl.owner.logo && (
              <img src={tmpl.owner.logo} alt="" className="size-5 rounded-full object-cover" />
            )}
            @{tmpl.owner.slug}
            {tmpl.owner.isVerified && (
              <Badge variant="secondary" className="text-[10px]">
                verified
              </Badge>
            )}
          </Link>
        )}
      </div>
    </>
  );
}

function TemplateMetadata({ tmpl }: { tmpl: TemplateDetail }) {
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div>
        <p className="text-xs text-muted-foreground">Version</p>
        <p className="mt-0.5 font-mono font-medium">{tmpl.latestVersion ?? "-"}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">License</p>
        <p className="mt-0.5 font-medium">{tmpl.license}</p>
      </div>
    </div>
  );
}

function ExternalLinks({ tmpl }: { tmpl: TemplateDetail }) {
  if (!tmpl.homepage && !tmpl.repository) return null;

  return (
    <>
      <Separator />
      {tmpl.homepage && (
        <a
          href={tmpl.homepage}
          target="_blank"
          rel="noreferrer"
          className="block text-sm text-primary hover:underline"
        >
          Homepage
        </a>
      )}
      {tmpl.repository && (
        <a
          href={tmpl.repository}
          target="_blank"
          rel="noreferrer"
          className="block text-sm text-primary hover:underline"
        >
          Repository
        </a>
      )}
    </>
  );
}

function OwnerActions() {
  const {
    tmpl,
    mutationPending,
    deprecateInput,
    setDeprecateInput,
    deprecateMutation,
    undeprecateMutation,
  } = useTemplateDetailWorkflowContext();

  return (
    <>
      <Separator />
      <p className="text-xs font-medium text-muted-foreground">Owner actions</p>
      <Button
        size="sm"
        variant="outline"
        className="w-full"
        nativeButton={false}
        render={<Link to="/account" />}
      >
        Manage in account
      </Button>
      {tmpl.isDeprecated ? (
        <AlertDialog>
          <AlertDialogTrigger
            disabled={mutationPending}
            render={<Button size="sm" variant="outline" className="w-full" />}
          >
            Restore
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove deprecation?</AlertDialogTitle>
              <AlertDialogDescription>
                This template will be listed as active again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => undeprecateMutation.mutate()}>
                Remove deprecation
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <AlertDialog>
          <AlertDialogTrigger
            disabled={mutationPending}
            render={
              <Button
                size="sm"
                variant="outline"
                className="w-full text-destructive hover:text-destructive"
              />
            }
          >
            Deprecate template
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Deprecate {tmpl.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                Users will see a deprecation warning. You can restore it later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="px-6 pb-2">
              <Input
                placeholder="Deprecation message (optional)"
                value={deprecateInput}
                onChange={(e) => setDeprecateInput(e.target.value)}
                className="text-sm"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => deprecateMutation.mutate()}
              >
                Deprecate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

function AdminActions() {
  const { tmpl, verifyMutation } = useTemplateDetailWorkflowContext();
  return (
    <>
      <Separator />
      <p className="text-xs font-medium text-muted-foreground">Admin</p>
      <Button
        size="sm"
        variant={tmpl.isTemplateVerified ? "outline" : "default"}
        className="w-full"
        onClick={() => verifyMutation.mutate()}
        disabled={verifyMutation.isPending}
      >
        {tmpl.isTemplateVerified ? "Remove verification" : "Verify template"}
      </Button>
    </>
  );
}
