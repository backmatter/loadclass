import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { TemplateDetail, TemplateVersion } from "@/lib/api";
import {
  templateVersionTags,
  useTemplateDetailWorkflowContext,
  useTemplateVersionWorkflow,
} from "@/lib/template-detail-workflow";

interface TemplateVersionHistoryProps {
  tmpl: TemplateDetail;
  canManage: boolean;
}

export function TemplateVersionHistory({ tmpl, canManage }: TemplateVersionHistoryProps) {
  return (
    <div className="mt-6 sm:mt-8">
      <h2 className="mb-3 text-sm font-semibold text-foreground">Version history</h2>
      <div className="space-y-2 sm:space-y-1.5">
        {tmpl.versions.map((version) => (
          <VersionRow
            key={version.id}
            version={version}
            templateName={tmpl.name}
            tags={templateVersionTags(tmpl, version.version)}
            canManage={canManage}
            isLocal={tmpl.isLocal}
          />
        ))}
      </div>
    </div>
  );
}

function VersionRow({
  version,
  templateName,
  tags,
  canManage,
  isLocal,
}: {
  version: TemplateVersion;
  templateName: string;
  tags: string[];
  canManage: boolean;
  isLocal: boolean;
}) {
  const { downloadVersion, downloading } = useTemplateDetailWorkflowContext();
  const { isStable, stableMutation, toggleStable, yankMutation, yank } = useTemplateVersionWorkflow({
    templateName,
    version,
    tags,
  });

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-card px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="font-mono text-sm text-foreground">{version.version}</span>
        {tags.map((tag) => (
          <Badge key={tag} variant="outline" className="font-mono text-[10px]">
            {tag}
          </Badge>
        ))}
        {version.isYanked && (
          <Badge variant="destructive" className="text-[10px]">
            yanked
          </Badge>
        )}
      </div>
      <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end sm:gap-3">
        <span className="text-xs text-muted-foreground">
          {new Date(version.createdAt).toLocaleDateString()}
        </span>
        {isLocal && !version.isYanked && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs sm:h-6"
            onClick={() => void downloadVersion(version.version)}
            disabled={downloading}
          >
            Download
          </Button>
        )}
        {canManage && isLocal && !version.isYanked && (
          <>
            <button
              type="button"
              disabled={stableMutation.isPending}
              onClick={toggleStable}
              className="text-xs text-muted-foreground hover:text-primary disabled:opacity-50"
            >
              {isStable ? "Unset stable" : "Set stable"}
            </button>
            <AlertDialog>
              <AlertDialogTrigger
                disabled={yankMutation.isPending}
                className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
              >
                Yank
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Yank v{version.version}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Users won't be able to download this version. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={yank}>
                    Yank version
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </div>
  );
}
