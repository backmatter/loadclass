import { Link } from "@tanstack/react-router";
import { GithubIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isAdminSession, useSession } from "@/lib/auth-client";

const GITHUB_REPO_URL = "https://github.com/backmatter/loadclass";

export function AppNav({ activePath }: { activePath?: string }) {
  const { data: session, isPending } = useSession();

  return (
    <nav className="sticky top-0 z-20 border-b border-border bg-background/95 px-6 py-2 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <Link
          to="/"
          className="flex flex-shrink-0 items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BrandLogo variant="wordmark" imgClassName="h-7 w-auto max-w-[160px] sm:max-w-none" />
        </Link>
        <div className="flex min-w-0 items-center gap-4 overflow-x-auto whitespace-nowrap">
          <Link
            to="/templates"
            className={`text-sm ${activePath === "templates" ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Browse
          </Link>
          <Link
            to="/docs"
            className={`text-sm ${activePath === "docs" ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            API docs
          </Link>
          {!isPending &&
            (session ? (
              <>
                <Link
                  to="/publish"
                  className={`text-sm ${activePath === "publish" ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Publish
                </Link>
                {isAdminSession(session) && (
                  <Link
                    to="/admin"
                    className={`text-sm ${activePath === "admin" ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Admin
                  </Link>
                )}
                <Link
                  to="/account"
                  className={`text-sm ${activePath === "account" ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Account
                </Link>
              </>
            ) : null)}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open GitHub repository"
                  nativeButton={false}
                  render={
                    <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer" />
                  }
                />
              }
            >
              <GithubIcon data-icon />
            </TooltipTrigger>
            <TooltipContent>GitHub repository</TooltipContent>
          </Tooltip>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
