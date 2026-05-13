import { useRuntimeConfig, type RuntimePublicConfig } from "./runtime-config";

export interface AuthProviderSettings {
  socialAuthProviders: {
    google: boolean;
    github: boolean;
  };
  hasSocialAuthProvider: boolean;
  emailPasswordAuthEnabled: boolean;
}

export function authProviderSettings(config: RuntimePublicConfig): AuthProviderSettings {
  const enabledProviders = new Set(config.authProviders);
  const socialAuthProviders = {
    google: enabledProviders.has("google"),
    github: enabledProviders.has("github"),
  };

  return {
    socialAuthProviders,
    hasSocialAuthProvider: socialAuthProviders.google || socialAuthProviders.github,
    emailPasswordAuthEnabled: config.emailPasswordAuthEnabled,
  };
}

export function useAuthProviderSettings(): AuthProviderSettings {
  return authProviderSettings(useRuntimeConfig());
}
