import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppNav } from "@/components/app-nav";
import { TemplateDetailActionPanel } from "@/components/template-detail-action-panel";
import { TemplateVersionHistory } from "@/components/template-version-history";
import { type AuthSession } from "@/lib/auth-client";
import type { TemplateDetail } from "@/lib/api";
import { TemplateDetailWorkflowProvider } from "@/lib/template-detail-workflow";

interface TemplateDetailViewProps {
  tmpl: TemplateDetail;
  session: AuthSession | null | undefined;
  onLoginRequired: () => void;
}

export function TemplateDetailView({ tmpl, session, onLoginRequired }: TemplateDetailViewProps) {
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <TemplateDetailWorkflowProvider tmpl={tmpl}>
      <div className="min-h-svh bg-background">
        <AppNav activePath="templates" />

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {tmpl.isDeprecated && (
            <div className="mb-6 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <strong>Deprecated</strong>
              {tmpl.deprecationMessage && (
                <span className="text-foreground/70"> - {tmpl.deprecationMessage}</span>
              )}
            </div>
          )}

          <div className="flex flex-col gap-6 lg:flex-row lg:gap-12">
            <div className="min-w-0 flex-1">
              <div>
                <h1 className="text-xl font-bold text-foreground sm:text-2xl">{tmpl.title}</h1>
                <div className="mt-2 flex flex-wrap gap-2">
                  {tmpl.isVerified && <Badge variant="secondary">verified</Badge>}
                  {!tmpl.isLocal && <Badge variant="outline">upstream</Badge>}
                  {tmpl.isDeprecated && <Badge variant="destructive">deprecated</Badge>}
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">{tmpl.description}</p>
              {tmpl.upstreamRegistry && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Resolved from {tmpl.upstreamRegistry}
                </p>
              )}

              <TemplateDetailActionPanel
                layout="mobile"
                session={session}
                onLoginRequired={onLoginRequired}
              />

              {tmpl.thumbnailUrl && (
                <button
                  type="button"
                  className="mx-auto mt-5 flex aspect-[210/297] w-full max-w-[31rem] cursor-zoom-in items-center justify-center overflow-hidden rounded-md border border-border bg-white shadow-sm transition-shadow hover:shadow-md sm:max-w-[34rem] lg:max-w-[31rem] xl:max-w-[34rem]"
                  onClick={() => setPreviewOpen(true)}
                >
                  <img
                    src={tmpl.thumbnailUrl}
                    alt={`${tmpl.title} preview`}
                    className="h-full w-full object-contain"
                  />
                  <span className="sr-only">Open larger preview</span>
                </button>
              )}

              <TemplateVersionHistory tmpl={tmpl} canManage={tmpl.canManage} />
            </div>

            <TemplateDetailActionPanel
              layout="sidebar"
              session={session}
              onLoginRequired={onLoginRequired}
            />
          </div>
        </main>
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-h-[calc(100svh-2rem)] overflow-hidden sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle>{tmpl.title}</DialogTitle>
              <DialogDescription>Template preview</DialogDescription>
            </DialogHeader>
            {tmpl.thumbnailUrl && (
              <div className="flex h-[calc(100svh-10rem)] min-h-96 items-center justify-center overflow-auto rounded-lg bg-background p-4">
                <img
                  src={tmpl.thumbnailUrl}
                  alt={`${tmpl.title} preview`}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TemplateDetailWorkflowProvider>
  );
}
