const DEVELOPMENT_AUTH_SECRETS = [
  "loadclass-dev-secret-change-me",
  "loadclass-dev-auth-secret-change-before-production",
];
const DEVELOPMENT_PREVIEW_WORKER_TOKEN = "loadclass-dev-preview-token-change-before-production";
const DEVELOPMENT_STORAGE_SECRETS = ["loadclass", "loadclass-dev-password"];

export function isProductionRuntime(): boolean {
  const runtimeEnv = configuredValue("LOADCLASS_RUNTIME_ENV").toLowerCase();
  if (runtimeEnv) return runtimeEnv === "production";

  return process.env.NODE_ENV === "production" || process.env.BUN_ENV === "production";
}

function configuredFlag(name: string): boolean | null {
  const value = process.env[name];
  if (value == null) return null;
  return value !== "false";
}

function configuredValue(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function configuredList(name: string): Set<string> {
  return new Set(
    configuredValue(name)
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

function requireRuntimeValue(name: string, errors: string[]): void {
  if (!configuredValue(name)) errors.push(`${name} is required`);
}

function requireRuntimeSecret(
  name: string,
  errors: string[],
  options: { minLength?: number; disallow?: string[] } = {},
): void {
  const value = configuredValue(name);
  if (!value) {
    errors.push(`${name} is required`);
    return;
  }

  if (options.disallow?.includes(value)) {
    errors.push(`${name} must not use a development default`);
  }

  if (value.length < (options.minLength ?? 32)) {
    errors.push(`${name} must be at least ${options.minLength ?? 32} characters`);
  }
}

function requireUrl(name: string, errors: string[]): void {
  const value = configuredValue(name);
  if (!value) {
    errors.push(`${name} is required`);
    return;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      errors.push(`${name} must use http or https`);
    }
  } catch {
    errors.push(`${name} must be a valid URL`);
  }
}

function urlHost(name: string): string | null {
  const value = configuredValue(name);
  if (!value) return null;
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

function requireCookieDomain(name: string, errors: string[]): void {
  const value = configuredValue(name);
  if (!value) {
    errors.push(`${name} is required when the web and API use different hostnames`);
    return;
  }

  if (value.includes("/") || value.includes(":")) {
    errors.push(`${name} must be a cookie domain such as loadclass.eu, not a URL`);
  }
}

function assertRuntimeConfig(errors: string[]): void {
  if (errors.length === 0) return;

  throw new Error(`Invalid production configuration:\n- ${errors.join("\n- ")}`);
}

export function assertApiRuntimeConfig({ corsOrigins }: { corsOrigins: string[] }): void {
  if (!isProductionRuntime()) return;

  const errors: string[] = [];
  const authProviders = configuredList("LOADCLASS_AUTH_PROVIDERS");
  requireRuntimeValue("DATABASE_URL", errors);
  requireRuntimeSecret("BETTER_AUTH_SECRET", errors, { disallow: DEVELOPMENT_AUTH_SECRETS });
  requireUrl("LOADCLASS_PUBLIC_API_URL", errors);
  requireUrl("LOADCLASS_SITE_URL", errors);
  requireRuntimeValue("LOADCLASS_EMAIL_PASSWORD_AUTH_ENABLED", errors);
  requireRuntimeValue("TRUSTED_ORIGINS", errors);
  requireRuntimeValue("S3_BUCKET", errors);
  requireRuntimeValue("S3_ACCESS_KEY", errors);
  requireRuntimeSecret("S3_SECRET_KEY", errors, {
    minLength: 16,
    disallow: DEVELOPMENT_STORAGE_SECRETS,
  });

  const siteHost = urlHost("LOADCLASS_SITE_URL");
  const apiHost = urlHost("LOADCLASS_PUBLIC_API_URL");
  if (siteHost && apiHost && siteHost !== apiHost) {
    requireCookieDomain("LOADCLASS_AUTH_COOKIE_DOMAIN", errors);
  }

  if (corsOrigins.length === 0) {
    errors.push("CORS_ORIGINS or LOADCLASS_SITE_URL must define at least one allowed browser origin");
  }

  if (configuredFlag("ALLOW_PUBLISHING") !== false) {
    requireUrl("TEMPLATE_PREVIEW_WORKER_URL", errors);
    requireRuntimeSecret("PREVIEW_WORKER_TOKEN", errors, {
      disallow: [DEVELOPMENT_PREVIEW_WORKER_TOKEN],
    });
  }

  if (configuredFlag("LOADCLASS_EMAIL_PASSWORD_AUTH_ENABLED") !== false) {
    requireRuntimeValue("LOADCLASS_SMTP_HOST", errors);
    requireRuntimeValue("LOADCLASS_SMTP_PORT", errors);
    requireRuntimeValue("LOADCLASS_EMAIL_FROM", errors);

    if (configuredValue("LOADCLASS_SMTP_USER") && !configuredValue("LOADCLASS_SMTP_PASS")) {
      errors.push("LOADCLASS_SMTP_PASS is required when LOADCLASS_SMTP_USER is set");
    }
  }

  for (const provider of authProviders) {
    if (provider !== "google" && provider !== "github") {
      errors.push(`LOADCLASS_AUTH_PROVIDERS contains unsupported provider: ${provider}`);
    }
  }

  if (authProviders.has("google")) {
    requireRuntimeValue("LOADCLASS_GOOGLE_CLIENT_ID", errors);
    requireRuntimeValue("LOADCLASS_GOOGLE_CLIENT_SECRET", errors);
  }

  if (authProviders.has("github")) {
    requireRuntimeValue("LOADCLASS_GITHUB_CLIENT_ID", errors);
    requireRuntimeValue("LOADCLASS_GITHUB_CLIENT_SECRET", errors);
  }

  assertRuntimeConfig(errors);
}

export function assertPreviewWorkerRuntimeConfig(): void {
  if (!isProductionRuntime()) return;

  const errors: string[] = [];
  requireRuntimeSecret("PREVIEW_WORKER_TOKEN", errors, {
    disallow: [DEVELOPMENT_PREVIEW_WORKER_TOKEN],
  });
  assertRuntimeConfig(errors);
}
