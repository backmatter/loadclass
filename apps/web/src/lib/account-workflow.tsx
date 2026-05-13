import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";
import { useAuthClient } from "./auth-client";
import {
  apiKeysQuery,
  fullOrganizationQuery,
  myTemplatesQuery,
  organizationsQuery,
} from "./api";
import { useRuntimeConfig } from "./runtime-config";
import { useAccountUiStore } from "./ui-store";

function useAccountWorkflow() {
  const queryClient = useQueryClient();
  const authClient = useAuthClient();
  const navigate = useNavigate();
  const runtimeConfig = useRuntimeConfig();

  const setKeyName = useAccountUiStore((state) => state.setKeyName);
  const setNewKey = useAccountUiStore((state) => state.setNewKey);
  const resetOrgForm = useAccountUiStore((state) => state.resetOrgForm);
  const resetInviteForm = useAccountUiStore((state) => state.resetInviteForm);

  const keysQuery = apiKeysQuery(authClient);
  const orgsQuery = organizationsQuery(authClient);
  const templatesQuery = myTemplatesQuery(runtimeConfig);
  const fullOrgQuery = (orgId: string) => fullOrganizationQuery(authClient, orgId);

  const createKeyMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await authClient.apiKey.create({ name });
      if (error || !data) throw new Error(error?.message ?? "Failed to create API key");
      return data as { key?: string };
    },
    onSuccess: (data) => {
      setNewKey(data.key ?? null);
      setKeyName("");
      queryClient.invalidateQueries({ queryKey: keysQuery.queryKey });
    },
  });

  const deleteKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const { error } = await authClient.apiKey.delete({ keyId });
      if (error) throw new Error(error.message ?? "Failed to delete API key");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keysQuery.queryKey }),
  });

  const createOrgMutation = useMutation({
    mutationFn: async ({ name, slug }: { name: string; slug: string }) => {
      const { error } = await authClient.organization.create({ name, slug });
      if (error) throw new Error(error.message ?? "Failed to create organization");
    },
    onSuccess: () => {
      resetOrgForm();
      queryClient.invalidateQueries({ queryKey: orgsQuery.queryKey });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async ({ orgId, email }: { orgId: string; email: string }) => {
      const { error } = await authClient.organization.inviteMember({
        organizationId: orgId,
        email,
        role: "member",
      });
      if (error) throw new Error(error.message ?? "Failed to invite member");
    },
    onSuccess: (_data, variables) => {
      resetInviteForm();
      queryClient.invalidateQueries({ queryKey: fullOrgQuery(variables.orgId).queryKey });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async ({ orgId, memberIdOrEmail }: { orgId: string; memberIdOrEmail: string }) => {
      const { error } = await authClient.organization.removeMember({
        organizationId: orgId,
        memberIdOrEmail,
      });
      if (error) throw new Error(error.message ?? "Failed to remove member");
    },
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: fullOrgQuery(variables.orgId).queryKey }),
  });

  async function signOut() {
    await authClient.signOut();
    queryClient.removeQueries({ queryKey: ["auth"] });
    navigate({ to: "/" });
  }

  return {
    keysQuery,
    orgsQuery,
    templatesQuery,
    fullOrgQuery,
    createKeyMutation,
    deleteKeyMutation,
    createOrgMutation,
    inviteMutation,
    removeMemberMutation,
    signOut,
  };
}

type AccountWorkflow = ReturnType<typeof useAccountWorkflow>;

export type AccountInviteMutation = UseMutationResult<
  void,
  Error,
  { orgId: string; email: string }
>;
export type AccountRemoveMemberMutation = UseMutationResult<
  void,
  Error,
  { orgId: string; memberIdOrEmail: string }
>;

const AccountWorkflowContext = createContext<AccountWorkflow | null>(null);

export function AccountWorkflowProvider({ children }: { children: ReactNode }) {
  const workflow = useAccountWorkflow();
  return (
    <AccountWorkflowContext.Provider value={workflow}>
      {children}
    </AccountWorkflowContext.Provider>
  );
}

export function useAccountWorkflowContext(): AccountWorkflow {
  const ctx = useContext(AccountWorkflowContext);
  if (!ctx) {
    throw new Error(
      "useAccountWorkflowContext must be used inside <AccountWorkflowProvider>",
    );
  }
  return ctx;
}
