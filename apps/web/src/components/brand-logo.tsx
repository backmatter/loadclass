import { cn } from "@/lib/utils";

type BrandLogoProps = {
  variant?: "mark" | "wordmark";
  className?: string;
  imgClassName?: string;
};

const logoSources = {
  mark: {
    lightTheme: "/brand/logo-mark-dark.svg",
    darkTheme: "/brand/logo-mark-light.svg",
  },
  wordmark: {
    lightTheme: "/brand/logo-wordmark-dark.svg",
    darkTheme: "/brand/logo-wordmark-light.svg",
  },
};

export function BrandLogo({ variant = "mark", className, imgClassName }: BrandLogoProps) {
  const sources = logoSources[variant];

  return (
    <span className={cn("inline-flex items-center", className)} role="img" aria-label="\\loadclass{}">
      <img src={sources.lightTheme} alt="" className={cn("block dark:hidden", imgClassName)} />
      <img src={sources.darkTheme} alt="" className={cn("hidden dark:block", imgClassName)} />
    </span>
  );
}
