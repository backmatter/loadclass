import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ThemeToggle() {
  const { hydrated, resolvedTheme, setTheme } = useTheme();
  const visibleTheme = hydrated ? resolvedTheme : "light";
  const nextTheme = visibleTheme === "dark" ? "light" : "dark";
  const label = visibleTheme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={label}
            disabled={!hydrated}
            onClick={() => setTheme(nextTheme)}
          />
        }
      >
        {visibleTheme === "dark" ? <MoonIcon data-icon /> : <SunIcon data-icon />}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
