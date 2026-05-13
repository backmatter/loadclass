import { createFileRoute, Link } from "@tanstack/react-router";
import { AppNav } from "@/components/app-nav";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { organizationJsonLd, pageMeta, websiteJsonLd } from "@/lib/site-metadata";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () =>
    pageMeta({
      title: "Loadclass - LaTeX templates for papers, theses, and presentations",
      path: "/",
      jsonLd: {
        "@context": "https://schema.org",
        "@graph": [websiteJsonLd(), organizationJsonLd()],
      },
    }),
});

const FEATURES = [
  {
    num: "01",
    heading: "All in one place",
    body: "Conference papers, theses, presentations — stop hunting across journal and university websites.",
  },
  {
    num: "02",
    heading: "Any document type",
    body: "Papers, theses, posters, slides, CVs — whatever you're writing or submitting to.",
  },
  {
    num: "03",
    heading: "Free to browse",
    body: "No account needed. Find and download any template.",
  },
  {
    num: "04",
    heading: "Open source",
    body: "Universities and departments can run their own private instance.",
  },
];

function HomePage() {
  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background text-foreground">
      <AppNav />
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-1 flex-col justify-center">
          <div className="mx-auto w-full max-w-7xl px-10">
            <BrandLogo variant="wordmark" imgClassName="mb-6 h-12 w-auto" />
            <h1 className="max-w-4xl font-serif text-6xl leading-[1.1] text-foreground xl:text-7xl">
              A template registry to unify the LaTeX ecosystem.
            </h1>
            <p className="mt-5 max-w-md leading-relaxed text-muted-foreground">
              Find the right template for your paper, thesis, or presentation.
            </p>
            <div className="mt-6">
              <Button nativeButton={false} render={<Link to="/templates" />}>
                Browse templates
              </Button>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-border">
          <div className="mx-auto w-full max-w-7xl px-10 py-3">
            <div className="flex items-center gap-8">
              {FEATURES.map(({ num, heading, body }) => (
                <Tooltip key={num}>
                  <TooltipTrigger>
                    <span className="border-b border-dotted border-muted-foreground/50 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground">
                      {num} {heading}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">{body}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
