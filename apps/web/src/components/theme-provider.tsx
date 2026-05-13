import { createContext, useContext, useEffect, useMemo } from "react";
import { useThemeUiStore, type ResolvedTheme, type Theme } from "@/lib/ui-store";

type ThemeProviderState = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  hydrated: boolean;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeProviderState>({
  theme: "system",
  resolvedTheme: "light",
  hydrated: false,
  setTheme: () => {},
});

const STORAGE_KEY = "loadclass-theme";

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeUiStore((state) => state.theme);
  const systemTheme = useThemeUiStore((state) => state.systemTheme);
  const hydrated = useThemeUiStore((state) => state.hydrated);
  const setThemeState = useThemeUiStore((state) => state.setTheme);
  const setSystemTheme = useThemeUiStore((state) => state.setSystemTheme);
  const hydrateTheme = useThemeUiStore((state) => state.hydrateTheme);

  const resolvedTheme = useMemo<ResolvedTheme>(
    () => (theme === "system" ? systemTheme : theme),
    [systemTheme, theme],
  );

  useEffect(() => {
    const nextSystemTheme = getSystemTheme();
    const storedTheme = localStorage.getItem(STORAGE_KEY);
    const nextTheme =
      storedTheme === "light" || storedTheme === "dark" || storedTheme === "system"
        ? storedTheme
        : "system";

    hydrateTheme(nextTheme, nextSystemTheme);
  }, [hydrateTheme]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setSystemTheme(media.matches ? "dark" : "light");
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [setSystemTheme]);

  const value: ThemeProviderState = {
    theme,
    resolvedTheme,
    hydrated,
    setTheme: (next: Theme) => {
      localStorage.setItem(STORAGE_KEY, next);
      setThemeState(next);
    },
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
