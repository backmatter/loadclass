import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthClientProvider } from "@/lib/auth-client";
import appCss from "../styles.css?url";
import { defaultSiteDescription, siteUrl } from "@/lib/site-metadata";
import {
  getRuntimePublicConfig,
  runtimeConfigFromContext,
  type RuntimePublicConfig,
} from "@/lib/runtime-config";

interface RouterContext {
  queryClient: QueryClient;
  runtimeConfig?: RuntimePublicConfig;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async () => ({ runtimeConfig: await getRuntimePublicConfig() }),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Loadclass - LaTeX templates for papers, theses, and presentations" },
      { name: "description", content: defaultSiteDescription },
      { name: "theme-color", content: "#F4F0E4" },
      { name: "application-name", content: "Loadclass" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
      {
        rel: "sitemap",
        type: "application/xml",
        href: `${siteUrl()}/sitemap.xml`,
      },
    ],
  }),
  notFoundComponent: () => (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Page not found</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">The page you requested does not exist.</p>
          <Button variant="outline" nativeButton={false} render={<Link to="/" />}>
            Go home
          </Button>
        </CardContent>
      </Card>
    </main>
  ),
  errorComponent: ({ error }) => {
    const message =
      import.meta.env.DEV && error instanceof Error
        ? error.message
        : "An unexpected error occurred.";

    return (
      <main className="flex min-h-svh items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Something went wrong</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">{message}</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Reload page
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  },
  component: RootComponent,
});

function RootComponent() {
  const runtimeConfig = runtimeConfigFromContext(Route.useRouteContext());

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <AuthClientProvider apiUrl={runtimeConfig.apiUrl}>
          <ThemeProvider>
            <TooltipProvider>
              <Outlet />
              <Toaster />
            </TooltipProvider>
          </ThemeProvider>
        </AuthClientProvider>
        <TanStackRouterDevtools />
        <Scripts />
      </body>
    </html>
  );
}
