import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useCallback } from "react";
import { useSession } from "@/lib/auth-client";
import { requireRouteSession } from "@/lib/auth-guards";
import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UploadIcon, CheckIcon } from "lucide-react";
import { categoriesQuery, publishTemplatePackage } from "@/lib/api";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { privatePageMeta } from "@/lib/site-metadata";
import { runtimeConfigFromContext, useRuntimeConfig } from "@/lib/runtime-config";
import {
  buildTemplateManifest,
  detectTemplatePackageFields,
  emptyPublishFormValues,
  fillDetectedPublishFields,
  publishFormErrorFromUnknown,
  type PublishFormError,
  type PublishFormField,
} from "@/lib/template-publish-workflow";

export const Route = createFileRoute("/publish")({
  beforeLoad: ({ context }) => requireRouteSession(context.queryClient, runtimeConfigFromContext(context)),
  head: () => privatePageMeta("Publish - Loadclass", "/publish"),
  component: PublishPage,
});

// ── component ────────────────────────────────────────────────────────────────

function PublishPage() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <p className="animate-pulse text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-svh bg-background">
      <AppNav activePath="publish" />
      <main className="mx-auto max-w-7xl px-10 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Publish a template</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a <code className="font-mono text-xs">.tar.gz</code> archive — we'll auto-detect
            as much as possible from a <code className="font-mono text-xs">loadclass.json</code>{" "}
            inside.
          </p>
        </div>
        <PublishForm />
      </main>
    </div>
  );
}

function DetectedBadge() {
  return (
    <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
      <CheckIcon className="size-2.5" /> auto
    </span>
  );
}

function PublishForm() {
  const navigate = useNavigate();
  const runtimeConfig = useRuntimeConfig();
  const { data: categories = [] } = useQuery(categoriesQuery(runtimeConfig));
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState<Set<PublishFormField>>(new Set());
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<PublishFormError | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [form, setForm] = useState(emptyPublishFormValues);

  function set(key: PublishFormField, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function field(key: PublishFormField) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        set(key, e.target.value);
        setDetected((d) => {
          const n = new Set(d);
          n.delete(key);
          return n;
        });
      },
    };
  }

  const runDetect = useCallback(async (f: File) => {
    setDetecting(true);
    setError(null);
    try {
      const detectedFields = await detectTemplatePackageFields(f);
      setForm((prev) => {
        const result = fillDetectedPublishFields(prev, detectedFields);
        setDetected(result.detected);
        return result.form;
      });
    } catch {
      setError({ message: "Could not parse the archive. Make sure it's a valid .tar.gz file." });
    } finally {
      setDetecting(false);
    }
  }, []);

  function handleFile(f: File | null) {
    if (!f) return;
    setFile(f);
    runDetect(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  async function publish() {
    if (!file) {
      setError({ message: "Select a .tar.gz archive." });
      return;
    }

    let manifest;
    try {
      manifest = buildTemplateManifest(form);
    } catch (error) {
      setError({ message: error instanceof Error ? error.message : String(error) });
      return;
    }

    setPublishing(true);
    setError(null);

    try {
      const data = await publishTemplatePackage(runtimeConfig, file, manifest);
      navigate({ to: "/templates/$name", params: { name: data.name } });
    } catch (error) {
      setError(publishFormErrorFromUnknown(error));
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload zone */}
      <div
        ref={dropRef}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : file
              ? "border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20"
              : "border-input hover:border-primary hover:bg-muted/30"
        }`}
      >
        <UploadIcon
          className={`mb-3 size-8 ${file ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}
        />
        {detecting ? (
          <p className="text-sm font-medium text-muted-foreground">Detecting metadata…</p>
        ) : file ? (
          <>
            <p className="text-sm font-medium text-foreground">{file.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">Click to replace</p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-foreground">Drop your .tar.gz here</p>
            <p className="mt-1 text-xs text-muted-foreground">or click to browse</p>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".tar.gz,.tgz"
          className="sr-only"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {/* Form */}
      <div className="space-y-4 rounded-xl border border-border p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Template details
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="pub-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="pub-name"
              placeholder="thesis-template"
              className="font-mono text-sm"
              {...field("name")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pub-version">
              Version <span className="text-destructive">*</span>
              {detected.has("version") && <DetectedBadge />}
            </Label>
            <Input
              id="pub-version"
              placeholder="1.0.0"
              className="font-mono text-sm"
              {...field("version")}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pub-desc">
            Description
            {detected.has("description") && <DetectedBadge />}
          </Label>
          <Input
            id="pub-desc"
            placeholder="A clean thesis template for…"
            {...field("description")}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="pub-license">
              License
              {detected.has("license") && <DetectedBadge />}
            </Label>
            <Input
              id="pub-license"
              placeholder="MIT"
              className="font-mono text-sm"
              {...field("license")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pub-category">
              Category <span className="text-destructive">*</span>
              {detected.has("category") && <DetectedBadge />}
            </Label>
            <NativeSelect
              id="pub-category"
              className="w-full"
              value={form.category}
              onChange={(e) => {
                set("category", e.target.value);
                setDetected((d) => {
                  const n = new Set(d);
                  n.delete("category");
                  return n;
                });
              }}
            >
              <NativeSelectOption value="">Select category</NativeSelectOption>
              {categories.map((category) => (
                <NativeSelectOption key={category.slug} value={category.slug}>
                  {category.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="pub-homepage">
              Homepage
              {detected.has("homepage") && <DetectedBadge />}
            </Label>
            <Input id="pub-homepage" placeholder="https://…" {...field("homepage")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pub-repo">
              Repository
              {detected.has("repository") && <DetectedBadge />}
            </Label>
            <Input id="pub-repo" placeholder="https://github.com/…" {...field("repository")} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pub-main">
            Entry point <span className="text-destructive">*</span>
            {detected.has("main") && <DetectedBadge />}
          </Label>
          <Input
            id="pub-main"
            placeholder="main.tex"
            className="font-mono text-sm"
            {...field("main")}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pub-files">
            Files in archive <span className="text-destructive">*</span>{" "}
            <span className="font-normal text-muted-foreground">(one per line)</span>
            {detected.has("files") && <DetectedBadge />}
          </Label>
          <Textarea
            id="pub-files"
            placeholder={"main.tex\nstyle.sty\nfigures/logo.pdf"}
            className="font-mono text-xs"
            rows={5}
            {...field("files")}
          />
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <p>{error.message}</p>
            {error.detail && <p className="mt-1 text-xs text-destructive/90">{error.detail}</p>}
            {error.code && (
              <p className="mt-2 font-mono text-[10px] uppercase tracking-wide text-destructive/80">
                {error.code}
              </p>
            )}
          </div>
        )}

        <Button onClick={publish} disabled={publishing || detecting} className="w-full">
          {publishing ? "Publishing…" : "Publish template"}
        </Button>
      </div>
    </div>
  );
}
