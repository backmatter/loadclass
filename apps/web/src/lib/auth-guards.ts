import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { sessionQuery } from "./api";
import { createLoadclassAuthClient, isAdminSession, type AuthSession } from "./auth-client";
import { internalApiUrl, type RuntimePublicConfig } from "./runtime-config";

const getServerRouteSession = createServerFn({ method: "GET" }).handler(async () => {
  const cookie = getRequestHeader("cookie");
  if (!cookie) return null;

  const response = await fetch(`${internalApiUrl()}/api/auth/get-session`, {
    headers: {
      accept: "application/json",
      cookie,
    },
  });

  if (!response.ok) return null;
  return (await response.json()) as AuthSession;
});

export async function requireRouteSession(
  queryClient: QueryClient,
  config: Pick<RuntimePublicConfig, "apiUrl">,
) {
  if (typeof window === "undefined") {
    const session = await getServerRouteSession();
    if (!session) {
      throw redirect({ to: "/login" });
    }
    return session;
  }

  const session = await queryClient.ensureQueryData(
    sessionQuery(createLoadclassAuthClient(config.apiUrl)),
  );
  if (!session) {
    throw redirect({ to: "/login" });
  }
  return session;
}

export async function requireAdminSession(
  queryClient: QueryClient,
  config: Pick<RuntimePublicConfig, "apiUrl">,
) {
  const session = await requireRouteSession(queryClient, config);
  if (!session) return null;

  if (!isAdminSession(session)) {
    throw redirect({ to: "/" });
  }
  return session;
}
