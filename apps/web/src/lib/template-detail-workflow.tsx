import { templateVersionDownloadPath } from "@loadclass/registry-contract";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useState, type ReactNode } from "react";
import {
  apiFetch,
  deleteDistTag,
  deprecateTemplate,
  removeTemplateVerification,
  restoreDeprecatedTemplate,
  setDistTag,
  setTemplateVerification,
  starTemplate,
  templateDetailQuery,
  unstarTemplate,
  yankTemplateVersion,
  type TemplateDetail,
  type TemplateVersion,
} from "./api";
import { useRuntimeConfig, type RuntimePublicConfig } from "./runtime-config";

function startDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function templateCitetProjectUrl(
  config: Pick<RuntimePublicConfig, "apiUrl" | "citetUrl">,
  tmpl: TemplateDetail,
) {
  if (!config.citetUrl) return null;

  return `${config.citetUrl.replace(/\/$/, "")}/templates/create?${new URLSearchParams({
    loadclassTemplate: tmpl.name,
    ...(tmpl.latestVersion ? { loadclassVersion: tmpl.latestVersion } : {}),
    loadclassApi: config.apiUrl,
  }).toString()}`;
}

export function templateVersionTags(tmpl: TemplateDetail, version: string) {
  return Object.entries(tmpl.distTags)
    .filter(([, taggedVersion]) => taggedVersion === version)
    .map(([tag]) => tag);
}

function useTemplateDetailWorkflow(tmpl: TemplateDetail) {
  const queryClient = useQueryClient();
  const runtimeConfig = useRuntimeConfig();
  const [deprecateInput, setDeprecateInput] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const invalidateTemplate = () =>
    queryClient.invalidateQueries({
      queryKey: templateDetailQuery(runtimeConfig, tmpl.name).queryKey,
    });

  const verifyMutation = useMutation({
    mutationFn: () =>
      tmpl.isTemplateVerified
        ? removeTemplateVerification(runtimeConfig, tmpl.name)
        : setTemplateVerification(runtimeConfig, tmpl.name),
    onSuccess: invalidateTemplate,
  });

  const starMutation = useMutation({
    mutationFn: () =>
      tmpl.isStarred
        ? unstarTemplate(runtimeConfig, tmpl.name)
        : starTemplate(runtimeConfig, tmpl.name),
    onSuccess: invalidateTemplate,
  });

  const deprecateMutation = useMutation({
    mutationFn: () =>
      deprecateTemplate(runtimeConfig, {
        name: tmpl.name,
        message: deprecateInput || undefined,
      }),
    onSuccess: () => {
      setDeprecateInput("");
      invalidateTemplate();
    },
  });

  const undeprecateMutation = useMutation({
    mutationFn: () => restoreDeprecatedTemplate(runtimeConfig, tmpl.name),
    onSuccess: invalidateTemplate,
  });

  async function downloadVersion(version: string | null) {
    if (!version) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const { url, filename } = await apiFetch<{ url: string; filename: string }>(
        runtimeConfig,
        templateVersionDownloadPath({ templateName: tmpl.name, version, source: "web" }),
      );
      startDownload(url, filename);
    } catch {
      setDownloadError("Download failed — check your connection");
    } finally {
      setDownloading(false);
    }
  }

  const mutationPending =
    verifyMutation.isPending ||
    starMutation.isPending ||
    deprecateMutation.isPending ||
    undeprecateMutation.isPending;

  return {
    tmpl,
    canDownloadLatest: tmpl.latestVersion != null,
    canStar: tmpl.isLocal,
    deprecateInput,
    deprecateMutation,
    downloadLatest: () => downloadVersion(tmpl.latestVersion),
    downloadError,
    downloading,
    downloadVersion,
    mutationPending,
    setDeprecateInput,
    starMutation,
    templateProjectUrl: templateCitetProjectUrl(runtimeConfig, tmpl),
    undeprecateMutation,
    verifyMutation,
  };
}

type TemplateDetailWorkflow = ReturnType<typeof useTemplateDetailWorkflow>;

const TemplateDetailWorkflowContext = createContext<TemplateDetailWorkflow | null>(null);

export function TemplateDetailWorkflowProvider({
  tmpl,
  children,
}: {
  tmpl: TemplateDetail;
  children: ReactNode;
}) {
  const workflow = useTemplateDetailWorkflow(tmpl);
  return (
    <TemplateDetailWorkflowContext.Provider value={workflow}>
      {children}
    </TemplateDetailWorkflowContext.Provider>
  );
}

export function useTemplateDetailWorkflowContext(): TemplateDetailWorkflow {
  const ctx = useContext(TemplateDetailWorkflowContext);
  if (!ctx) {
    throw new Error(
      "useTemplateDetailWorkflowContext must be used inside <TemplateDetailWorkflowProvider>",
    );
  }
  return ctx;
}

export function useTemplateVersionWorkflow({
  templateName,
  version,
  tags,
}: {
  templateName: string;
  version: TemplateVersion;
  tags: string[];
}) {
  const queryClient = useQueryClient();
  const runtimeConfig = useRuntimeConfig();
  const isStable = tags.includes("stable");
  const invalidateTemplate = () =>
    queryClient.invalidateQueries({
      queryKey: templateDetailQuery(runtimeConfig, templateName).queryKey,
    });

  const yankMutation = useMutation({
    mutationFn: () =>
      yankTemplateVersion(runtimeConfig, {
        name: templateName,
        version: version.version,
      }),
    onSuccess: invalidateTemplate,
  });

  const stableMutation = useMutation({
    mutationFn: () =>
      isStable
        ? deleteDistTag(runtimeConfig, { name: templateName, tag: "stable" })
        : setDistTag(runtimeConfig, {
            name: templateName,
            tag: "stable",
            version: version.version,
          }),
    onSuccess: invalidateTemplate,
  });

  return {
    isStable,
    stableMutation,
    toggleStable: () => stableMutation.mutate(),
    yankMutation,
    yank: () => yankMutation.mutate(),
  };
}
