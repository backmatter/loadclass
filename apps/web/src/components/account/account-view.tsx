import { AppNav } from "@/components/app-nav";
import { AccountApiKeysSection } from "@/components/account/api-keys-section";
import { AccountOrganizationsSection } from "@/components/account/organizations-section";
import { AccountProfileSection } from "@/components/account/profile-section";
import { AccountTemplatesSection } from "@/components/account/templates-section";
import type { AuthSession } from "@/lib/auth-client";
import { AccountWorkflowProvider } from "@/lib/account-workflow";

interface AccountViewProps {
  session: NonNullable<AuthSession>;
}

export function AccountView({ session }: AccountViewProps) {
  return (
    <AccountWorkflowProvider>
      <div className="min-h-svh bg-background">
        <AppNav />
        <main className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <AccountProfileSection session={session} />
          <AccountApiKeysSection />
          <AccountOrganizationsSection />
          <AccountTemplatesSection />
        </main>
      </div>
    </AccountWorkflowProvider>
  );
}
