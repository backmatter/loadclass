import { createFileRoute } from "@tanstack/react-router";
import { AccountView } from "@/components/account/account-view";
import { useSession } from "@/lib/auth-client";
import { requireRouteSession } from "@/lib/auth-guards";
import { privatePageMeta } from "@/lib/site-metadata";
import { runtimeConfigFromContext } from "@/lib/runtime-config";

export const Route = createFileRoute("/account")({
  beforeLoad: ({ context }) => requireRouteSession(context.queryClient, runtimeConfigFromContext(context)),
  head: () => privatePageMeta("Account - Loadclass", "/account"),
  component: AccountPage,
});

function AccountPage() {
  const { data: session, isPending } = useSession();

  if (isPending || !session) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <p className="animate-pulse text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return <AccountView session={session} />;
}
