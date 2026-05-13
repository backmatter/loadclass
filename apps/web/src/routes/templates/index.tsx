import { TEMPLATE_SORTS } from "@loadclass/registry-contract";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Fragment } from "react";
import { useInView } from "react-intersection-observer";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppNav } from "@/components/app-nav";
import { Download, Star, X } from "lucide-react";
import { categoriesQuery, templatesInfiniteQuery } from "@/lib/api";
import { pageMeta, siteUrl } from "@/lib/site-metadata";
import { runtimeConfigFromContext, useRuntimeConfig } from "@/lib/runtime-config";

const searchSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  sort: z.enum(TEMPLATE_SORTS).default("downloads"),
});

type SearchParams = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/templates/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    const runtimeConfig = runtimeConfigFromContext(context);
    return Promise.all([
      context.queryClient.ensureQueryData(categoriesQuery(runtimeConfig)),
      context.queryClient.prefetchInfiniteQuery(templatesInfiniteQuery(runtimeConfig, deps)),
    ]);
  },
  head: () =>
    pageMeta({
      title: "Browse LaTeX Templates - Loadclass",
      description:
        "Search and download LaTeX templates for journal articles, conference papers, theses, presentations, CVs, posters, reports, and assignments.",
      path: "/templates",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Browse LaTeX templates",
        description:
          "Search and download LaTeX templates for journal articles, conference papers, theses, presentations, CVs, posters, reports, and assignments.",
        url: `${siteUrl()}/templates`,
      },
    }),
  component: TemplatesBrowsePage,
});

const SORT_OPTIONS: Array<{ value: SearchParams["sort"]; label: string }> = [
  { value: "downloads", label: "Most downloaded" },
  { value: "weekly_downloads", label: "Trending" },
  { value: "stars", label: "Most starred" },
  { value: "newest", label: "Newest" },
];

const ALL_CATEGORIES_VALUE = "__all_categories__";

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </Field>
  );
}

function TemplateCardSkeleton() {
  return (
    <Card size="sm" className="h-full min-h-52">
      <CardHeader>
        <Skeleton className="h-4 w-28" />
        <CardAction>
          <Skeleton className="h-5 w-14 rounded-full" />
        </CardAction>
      </CardHeader>
      <CardFooter className="mt-auto gap-3">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-10" />
      </CardFooter>
    </Card>
  );
}

function TemplatesBrowsePage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const runtimeConfig = useRuntimeConfig();
  const { data: categoryList } = useSuspenseQuery(categoriesQuery(runtimeConfig));
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery(templatesInfiniteQuery(runtimeConfig, search));

  const { ref: sentinelRef } = useInView({
    rootMargin: "300px",
    onChange: (visible) => {
      if (visible && hasNextPage && !isFetching) {
        void fetchNextPage();
      }
    },
  });

  const hasActiveFilters = !!(search.q || search.category);
  const selectedSortLabel = SORT_OPTIONS.find((option) => option.value === search.sort)?.label;
  const selectedCategoryLabel = search.category
    ? categoryList.find((category) => category.slug === search.category)?.label
    : "All categories";

  function clearAll() {
    navigate({ search: { sort: search.sort } as SearchParams });
  }

  function goToSearch(nextSearch: SearchParams) {
    void navigate({ search: nextSearch });
  }

  return (
    <div className="min-h-svh">
      <AppNav activePath="templates" />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start lg:gap-8">
          <section className="min-w-0">
            <div>
              <h1 className="text-xl font-bold text-foreground sm:text-2xl">Browse templates</h1>
            </div>

            <InputGroup className="mt-4 sm:mt-5">
              <InputGroupInput
                type="search"
                placeholder="Search templates..."
                value={search.q ?? ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  void navigate({ search: { ...search, q: e.target.value || undefined } });
                }}
              />
              {search.q && (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    aria-label="Clear search"
                    onClick={() => goToSearch({ ...search, q: undefined })}
                    size="icon-xs"
                  >
                    <X />
                  </InputGroupButton>
                </InputGroupAddon>
              )}
            </InputGroup>

            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 lg:hidden">
              <Select
                value={search.sort}
                onValueChange={(v) => {
                  if (!v) return;
                  goToSearch({ ...search, sort: v as SearchParams["sort"] });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{selectedSortLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent align="start" alignItemWithTrigger={false}>
                  {SORT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {categoryList.length > 0 && (
                <Select
                  value={search.category ?? ALL_CATEGORIES_VALUE}
                  onValueChange={(value) => {
                    if (!value) return;
                    goToSearch({
                      ...search,
                      category: value === ALL_CATEGORIES_VALUE ? undefined : value,
                    });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>{selectedCategoryLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent align="end" alignItemWithTrigger={false}>
                    <SelectItem value={ALL_CATEGORIES_VALUE}>All categories</SelectItem>
                    {categoryList.map((cat) => (
                      <SelectItem key={cat.slug} value={cat.slug}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {hasActiveFilters && (
                <Button
                  type="button"
                  onClick={clearAll}
                  variant="ghost"
                  size="xs"
                  className="col-span-2 justify-self-start"
                >
                  Clear filters
                </Button>
              )}
            </div>

            {status === "error" && (
              <Alert variant="destructive" className="mt-6">
                <AlertTitle>Could not reach the registry API</AlertTitle>
                <AlertDescription>{error.message}</AlertDescription>
              </Alert>
            )}

            {status !== "error" && (
              <>
                <div className="mt-4 grid auto-rows-fr gap-3 sm:mt-6 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
                  {status === "pending"
                    ? Array.from({ length: 6 }).map((_, i) => <TemplateCardSkeleton key={i} />)
                    : data.pages.map((page) => (
                        <Fragment key={page.page}>
                          {page.templates.map((tmpl) => (
                            <Link
                              key={tmpl.id}
                              to="/templates/$name"
                              params={{ name: tmpl.name }}
                              className="group h-full"
                            >
                              <Card
                                size="sm"
                                className="h-full min-h-0 transition-colors group-hover:ring-primary max-sm:py-3"
                              >
                                <CardHeader className="max-sm:min-w-0 max-sm:px-3 max-sm:pb-1 max-sm:pt-0">
                                  <CardTitle className="line-clamp-3 group-hover:text-primary max-sm:text-sm">
                                    {tmpl.title}
                                  </CardTitle>
                                  {tmpl.isVerified && (
                                    <CardAction>
                                      <Badge variant="secondary">verified</Badge>
                                    </CardAction>
                                  )}
                                </CardHeader>
                                {tmpl.thumbnailUrl && (
                                  <div className="flex h-48 w-full items-center justify-center overflow-hidden bg-background max-sm:h-64 sm:h-60 lg:h-72 xl:h-80">
                                    <img
                                      src={tmpl.thumbnailUrl}
                                      alt={`${tmpl.title} preview`}
                                      className="h-full w-auto max-w-full object-contain shadow-sm"
                                    />
                                  </div>
                                )}
                                <CardFooter className="mt-auto gap-2 text-muted-foreground max-sm:px-3 max-sm:pt-0 sm:gap-3">
                                  <Badge variant="ghost">
                                    <Download />
                                    {tmpl.downloadCount.toLocaleString()}
                                  </Badge>
                                  <Badge variant="ghost">
                                    <Star />
                                    {tmpl.starCount}
                                  </Badge>
                                </CardFooter>
                              </Card>
                            </Link>
                          ))}
                        </Fragment>
                      ))}
                </div>

                {status === "success" &&
                  data.pages.every((page) => page.templates.length === 0) && (
                    <Empty className="mt-20 border-0">
                      <EmptyHeader>
                        <EmptyTitle>No templates found</EmptyTitle>
                      </EmptyHeader>
                      {hasActiveFilters && (
                        <EmptyContent>
                          <Button type="button" variant="ghost" onClick={clearAll}>
                            Clear filters
                          </Button>
                        </EmptyContent>
                      )}
                    </Empty>
                  )}

                <div ref={sentinelRef} className="h-1" />

                {isFetchingNextPage && (
                  <div className="mt-6 grid auto-rows-fr gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <TemplateCardSkeleton key={i} />
                    ))}
                  </div>
                )}
              </>
            )}
          </section>

          <aside className="hidden lg:sticky lg:top-20 lg:block">
            <div className="rounded-md border p-3 lg:border-y-0 lg:border-l lg:border-r-0 lg:bg-transparent lg:p-0 lg:pl-4">
              {hasActiveFilters && (
                <div className="mb-4 flex items-center justify-end">
                  <Button type="button" onClick={clearAll} variant="ghost" size="xs">
                    Clear
                  </Button>
                </div>
              )}

              <FieldGroup className="gap-3">
                <FilterField label="Sort">
                  <Select
                    value={search.sort}
                    onValueChange={(v) => {
                      if (!v) return;
                      goToSearch({ ...search, sort: v as SearchParams["sort"] });
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>{selectedSortLabel}</SelectValue>
                    </SelectTrigger>
                    <SelectContent align="end" alignItemWithTrigger={false}>
                      {SORT_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterField>

                {categoryList.length > 0 && (
                  <FilterField label="Category">
                    <Select
                      value={search.category ?? ALL_CATEGORIES_VALUE}
                      onValueChange={(value) => {
                        if (!value) return;
                        goToSearch({
                          ...search,
                          category: value === ALL_CATEGORIES_VALUE ? undefined : value,
                        });
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>{selectedCategoryLabel}</SelectValue>
                      </SelectTrigger>
                      <SelectContent align="end" alignItemWithTrigger={false}>
                        <SelectItem value={ALL_CATEGORIES_VALUE}>All categories</SelectItem>
                        {categoryList.map((cat) => (
                          <SelectItem key={cat.slug} value={cat.slug}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FilterField>
                )}
              </FieldGroup>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
