import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { GithubIcon } from "lucide-react";
import { useState } from "react";
import { useAuthClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { BrandLogo } from "@/components/brand-logo";
import {
  useAuthProviderSettings,
} from "@/lib/auth-providers";
import { privatePageMeta } from "@/lib/site-metadata";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => privatePageMeta("Sign in - Loadclass", "/login"),
});

function LoginPage() {
  const navigate = useNavigate();
  const authClient = useAuthClient();
  const { emailPasswordAuthEnabled, hasSocialAuthProvider, socialAuthProviders } =
    useAuthProviderSettings();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "github" | null>(null);

  async function signInWithProvider(provider: "google" | "github") {
    setError(null);
    setUnverified(false);
    setSocialLoading(provider);
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: `${window.location.origin}/templates`,
    });
    if (error) {
      setError(error.message ?? `Sign in with ${provider} failed`);
      setSocialLoading(null);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUnverified(false);
    setLoading(true);
    const { error } = await authClient.signIn.email({
      email,
      password,
      callbackURL: "/templates",
    });
    if (error) {
      if (error.code === "EMAIL_NOT_VERIFIED") {
        setUnverified(true);
      } else {
        setError(error.message ?? "Sign in failed");
      }
      setLoading(false);
    } else {
      navigate({ to: "/templates" });
    }
  };

  async function resendVerification() {
    setResendLoading(true);
    await authClient.sendVerificationEmail({
      email,
      callbackURL: `${window.location.origin}/account`,
    });
    setResendLoading(false);
    setResendSent(true);
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6">
        <Link
          to="/"
          className="inline-flex rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BrandLogo variant="wordmark" imgClassName="h-8 w-auto" />
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            {emailPasswordAuthEnabled ? (
              <CardDescription>
                Don't have an account?{" "}
                <Link to="/register" className="text-primary hover:underline">
                  Create one
                </Link>
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {error && (
                <p className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
              {unverified && (
                <div className="rounded border border-amber-400/30 bg-amber-50/50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
                  {resendSent ? (
                    "Verification email sent — check your inbox."
                  ) : (
                    <>
                      Your email isn't verified.{" "}
                      <button
                        type="button"
                        className="underline underline-offset-2 hover:opacity-70"
                        disabled={resendLoading}
                        onClick={resendVerification}
                      >
                        {resendLoading ? "Sending…" : "Resend verification email"}
                      </button>
                    </>
                  )}
                </div>
              )}
              {hasSocialAuthProvider ? (
                <>
                  <div className="grid gap-2">
                    {socialAuthProviders.google ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        disabled={socialLoading !== null}
                        onClick={() => signInWithProvider("google")}
                      >
                        {socialLoading === "google" ? "Connecting..." : "Continue with Google"}
                      </Button>
                    ) : null}
                    {socialAuthProviders.github ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        disabled={socialLoading !== null}
                        onClick={() => signInWithProvider("github")}
                      >
                        <GithubIcon data-icon="inline-start" />
                        {socialLoading === "github" ? "Connecting..." : "Continue with GitHub"}
                      </Button>
                    ) : null}
                  </div>
                  {emailPasswordAuthEnabled ? (
                    <div className="flex items-center gap-3">
                      <Separator className="flex-1" />
                      <span className="text-xs text-muted-foreground">or</span>
                      <Separator className="flex-1" />
                    </div>
                  ) : null}
                </>
              ) : null}
              {emailPasswordAuthEnabled ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="you@example.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <Link
                        to="/forgot-password"
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Signing in…" : "Sign in"}
                  </Button>
                </form>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
