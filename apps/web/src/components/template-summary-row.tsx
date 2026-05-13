import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import type { TemplateSummary } from "@/lib/api";

export function TemplateSummaryRow({
  template,
  emptyVersionLabel = "—",
}: {
  template: TemplateSummary;
  emptyVersionLabel?: string;
}) {
  return (
    <Link
      to="/templates/$name"
      params={{ name: template.name }}
      className="flex items-center justify-between rounded-md border border-border bg-card px-4 py-3 transition-colors hover:border-primary"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-mono text-sm font-medium">{template.name}</p>
          {template.isVerified && (
            <Badge variant="secondary" className="text-[10px]">
              verified
            </Badge>
          )}
          {template.isDeprecated && (
            <Badge variant="destructive" className="text-[10px]">
              deprecated
            </Badge>
          )}
        </div>
        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
          {template.description}
        </p>
      </div>
      <div className="ml-4 flex shrink-0 flex-col items-end gap-1">
        <Badge variant="outline" className="font-mono text-[10px]">
          {template.latestVersion ?? emptyVersionLabel}
        </Badge>
        <span className="text-xs text-muted-foreground">
          ↓ {template.downloadCount.toLocaleString()}
        </span>
      </div>
    </Link>
  );
}
