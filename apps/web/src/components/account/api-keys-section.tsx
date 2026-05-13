import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useAccountUiStore } from "@/lib/ui-store";
import { useAccountWorkflowContext } from "@/lib/account-workflow";

export function AccountApiKeysSection() {
  const keyName = useAccountUiStore((state) => state.keyName);
  const newKey = useAccountUiStore((state) => state.newKey);
  const copied = useAccountUiStore((state) => state.copied);
  const setKeyName = useAccountUiStore((state) => state.setKeyName);
  const setNewKey = useAccountUiStore((state) => state.setNewKey);
  const setCopied = useAccountUiStore((state) => state.setCopied);
  const { keysQuery, createKeyMutation, deleteKeyMutation } = useAccountWorkflowContext();

  const { data: keys = [], isLoading } = useQuery(keysQuery);

  function createKey() {
    if (!keyName.trim()) return;
    createKeyMutation.mutate(keyName.trim());
  }

  function copy() {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>API keys</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          API keys let you publish templates programmatically. Pass the key as a{" "}
          <code className="font-mono text-xs">Bearer</code> token in the{" "}
          <code className="font-mono text-xs">Authorization</code> header.
        </p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Key name, e.g. laptop-cli"
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createKey()}
            className="font-mono text-sm"
          />
          <Button
            onClick={createKey}
            disabled={createKeyMutation.isPending || !keyName.trim()}
            size="sm"
            className="sm:w-auto"
          >
            {createKeyMutation.isPending ? "Creating..." : "Create"}
          </Button>
        </div>

        {newKey && (
          <div className="rounded-md border border-amber-400/50 bg-amber-50/50 p-4 dark:bg-amber-950/20">
            <p className="mb-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
              Copy this key now. It will not be shown again.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="min-w-0 flex-1 overflow-x-auto rounded bg-background px-2 py-1 font-mono text-xs">
                {newKey}
              </code>
              <Button size="sm" variant="outline" onClick={copy}>
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <button
              className="mt-2 text-xs text-muted-foreground hover:underline"
              onClick={() => setNewKey(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        <Separator />

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading keys...</p>
        ) : keys.length === 0 ? (
          <p className="text-sm text-muted-foreground">No API keys yet.</p>
        ) : (
          <div className="space-y-2">
            {keys.map((key) => (
              <div
                key={key.id}
                className="flex flex-col gap-3 rounded-md border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{key.name ?? "Unnamed key"}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {key.start ?? key.prefix ?? "lc_..."}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Created {new Date(key.createdAt).toLocaleDateString()}
                    {key.lastUsedAt &&
                      ` - Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger className="self-start text-xs text-muted-foreground hover:text-destructive sm:self-center">
                    Delete
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete API key?</AlertDialogTitle>
                      <AlertDialogDescription>
                        <strong>{key.name ?? "This key"}</strong> will stop working immediately.
                        This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={() => deleteKeyMutation.mutate(key.id)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
