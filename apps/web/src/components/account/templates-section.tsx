import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { UploadIcon } from "lucide-react";
import { TemplateSummaryRow } from "@/components/template-summary-row";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAccountWorkflowContext } from "@/lib/account-workflow";

export function AccountTemplatesSection() {
  const { templatesQuery } = useAccountWorkflowContext();
  const { data, isLoading } = useQuery(templatesQuery);
  const templates = data?.templates ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>My templates</CardTitle>
        <Button size="sm" nativeButton={false} render={<Link to="/publish" />}>
          <UploadIcon className="mr-1.5 size-3.5" />
          Publish
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">You have not published any templates yet.</p>
        ) : (
          <div className="space-y-2">
            {templates.map((pkg) => (
              <TemplateSummaryRow key={pkg.id} template={pkg} emptyVersionLabel="no release" />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
