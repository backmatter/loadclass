import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AuthSession } from "@/lib/auth-client";
import { useAccountWorkflowContext } from "@/lib/account-workflow";

interface AccountProfileSectionProps {
  session: NonNullable<AuthSession>;
}

export function AccountProfileSection({ session }: AccountProfileSectionProps) {
  const { signOut } = useAccountWorkflowContext();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate font-medium">{session.user.name}</p>
            <p className="truncate text-sm text-muted-foreground">{session.user.email}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
