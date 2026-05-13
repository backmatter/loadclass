const METHOD_STYLES: Record<string, string> = {
  get: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  post: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  put: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  patch: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  delete: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  head: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  options: "bg-muted text-muted-foreground",
};

export function MethodBadge({ method, size = "sm" }: { method: string; size?: "xs" | "sm" }) {
  const styles = METHOD_STYLES[method.toLowerCase()] ?? METHOD_STYLES.get;
  const sizeClass = size === "xs" ? "h-4 w-11 text-[10px]" : "h-5 w-14 px-2 py-0.5 text-xs";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded font-mono font-bold uppercase ${sizeClass} ${styles}`}
    >
      {method}
    </span>
  );
}
