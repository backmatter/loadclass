import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, organization } from "better-auth/plugins";
import { apiKey } from "@better-auth/api-key";
import { db } from "@loadclass/db";
import { sendEmail } from "./email.ts";
import {
  organizationAccessControl,
  organizationRoles,
} from "./registry/organization-permissions.ts";

const registrationEnabled = process.env.ALLOW_REGISTRATION !== "false";
const emailPasswordEnabled = process.env.LOADCLASS_EMAIL_PASSWORD_AUTH_ENABLED !== "false";
const enabledAuthProviders = new Set(
  (process.env.LOADCLASS_AUTH_PROVIDERS ?? "")
    .split(",")
    .map((provider) => provider.trim().toLowerCase())
    .filter(Boolean),
);
const trustedOrigins = (process.env.TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const authCookieDomain = process.env.LOADCLASS_AUTH_COOKIE_DOMAIN?.trim() || undefined;
const googleClientId = process.env.LOADCLASS_GOOGLE_CLIENT_ID?.trim();
const googleClientSecret = process.env.LOADCLASS_GOOGLE_CLIENT_SECRET?.trim();
const githubClientId = process.env.LOADCLASS_GITHUB_CLIENT_ID?.trim();
const githubClientSecret = process.env.LOADCLASS_GITHUB_CLIENT_SECRET?.trim();
const hasGoogleCredentials = Boolean(googleClientId && googleClientSecret);
const hasGithubCredentials = Boolean(githubClientId && githubClientSecret);

function providerEnabled(provider: "google" | "github"): boolean {
  return enabledAuthProviders.has(provider);
}

function escapeHtml(value: string | null | undefined): string {
  return (value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sendAuthEmail({ to, subject, body }: { to: string; subject: string; body: string }) {
  void sendEmail({ to, subject, html: body }).catch((error) => {
    console.error("[auth-email] failed to send message:", error);
  });
}

const socialProviders = {
  ...(providerEnabled("google") && hasGoogleCredentials
    ? {
        google: {
          clientId: googleClientId!,
          clientSecret: googleClientSecret!,
          disableImplicitSignUp: !registrationEnabled,
        },
      }
    : {}),
  ...(providerEnabled("github") && hasGithubCredentials
    ? {
        github: {
          clientId: githubClientId!,
          clientSecret: githubClientSecret!,
          disableImplicitSignUp: !registrationEnabled,
        },
      }
    : {}),
};

export const auth = betterAuth({
  baseURL: process.env.LOADCLASS_PUBLIC_API_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg" }),
  advanced: authCookieDomain
    ? {
        crossSubDomainCookies: {
          enabled: true,
          domain: authCookieDomain,
        },
      }
    : undefined,
  socialProviders,
  emailAndPassword: {
    enabled: emailPasswordEnabled,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      const name = escapeHtml(user.name || "there");
      const resetUrl = escapeHtml(url);
      sendAuthEmail({
        to: user.email,
        subject: "Reset your loadclass password",
        body: `<p>Hi ${name},</p><p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request a password reset, you can ignore this email.</p>`,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      const name = escapeHtml(user.name || "there");
      const verificationUrl = escapeHtml(url);
      sendAuthEmail({
        to: user.email,
        subject: "Verify your loadclass account",
        body: `<p>Hi ${name},</p><p>Click the link below to verify your email address:</p><p><a href="${verificationUrl}">${verificationUrl}</a></p><p>If you didn't create an account, you can ignore this email.</p>`,
      });
    },
  },
  plugins: [
    admin(),
    // API keys for CLI publishing: `loadclass login` creates a key, `loadclass publish` uses it
    apiKey({
      defaultPrefix: "lc_",
      enableMetadata: true,
      enableSessionForAPIKeys: true,
      customAPIKeyGetter: (ctx) => {
        const authorization = ctx.headers?.get("authorization");
        if (authorization?.startsWith("Bearer ")) return authorization.slice("Bearer ".length);
        return ctx.headers?.get("x-api-key") ?? null;
      },
    }),
    // Organizations for scoped templates: @acm, @ieee, @mit
    organization({
      ac: organizationAccessControl,
      roles: organizationRoles,
      allowUserToCreateOrganization: true,
    }),
  ],
  trustedOrigins,
});

export type Auth = typeof auth;
