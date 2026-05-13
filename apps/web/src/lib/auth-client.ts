import { createContext, createElement, useContext, useMemo, type ReactNode } from "react";
import { createAuthClient } from "better-auth/react";
import { organizationClient, adminClient } from "better-auth/client/plugins";
import { apiKeyClient } from "@better-auth/api-key/client";

export function createLoadclassAuthClient(baseURL: string) {
  return createAuthClient({
    baseURL,
    plugins: [organizationClient(), apiKeyClient(), adminClient()],
  });
}

export type LoadclassAuthClient = ReturnType<typeof createLoadclassAuthClient>;

const AuthClientContext = createContext<LoadclassAuthClient | null>(null);

export function AuthClientProvider({
  apiUrl,
  children,
}: {
  apiUrl: string;
  children: ReactNode;
}) {
  const authClient = useMemo(() => createLoadclassAuthClient(apiUrl), [apiUrl]);

  return createElement(AuthClientContext.Provider, { value: authClient }, children);
}

export function useAuthClient(): LoadclassAuthClient {
  const authClient = useContext(AuthClientContext);
  if (!authClient) {
    throw new Error("Auth client is not available before runtime config is loaded");
  }
  return authClient;
}

export function useSession() {
  return useAuthClient().useSession();
}

export type AuthSession = Awaited<ReturnType<LoadclassAuthClient["getSession"]>>["data"];

export function isAdminSession(session: AuthSession | null | undefined): boolean {
  return (session?.user as { role?: string } | undefined)?.role === "admin";
}
