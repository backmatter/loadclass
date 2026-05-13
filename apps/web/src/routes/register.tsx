import { createFileRoute, Link } from "@tanstack/react-router";
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

export const Route = createFileRoute("/register")({
  component: RegisterPage,
  head: () => privatePageMeta("Create account - Loadclass", "/register"),
});

function RegisterPage() {
  const authClient = useAuthClient();
  const { emailPasswordAuthEnabled, hasSocialAuthProvider, socialAuthProviders } =
    useAuthProviderSettings();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "github" | null>(null);
  const [registered, setRegistered] = useState(false);

  async function signUpWithProvider(provider: "google" | "github") {
    setError(null);
    setSocialLoading(provider);
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: `${window.location.origin}/account`,
    });
    if (error) {
      setError(error.message ?? `Continue with ${provider} failed`);
      setSocialLoading(null);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await authClient.signUp.email({
      name,
      email,
      password,
      callbackURL: `${window.location.origin}/account`,
    });
    if (error) {
      setError(error.message ?? "Registration failed");
      setLoading(false);
    } else {
      setRegistered(true);
    }
  };

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
            <CardTitle>Create account</CardTitle>
            <CardDescription>
              Already have one?{" "}
              <Link to="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {registered ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  We've sent a verification link to <strong>{email}</strong>. Click it to activate
                  your account.
                </p>
                <p className="text-xs text-muted-foreground">
                  Check your spam folder if it doesn't arrive within a few minutes.
                </p>
                <Link to="/login" className="block text-sm text-primary hover:underline">
                  Back to sign in
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {error && (
                  <p className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
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
                          onClick={() => signUpWithProvider("google")}
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
                          onClick={() => signUpWithProvider("github")}
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
                      <Label htmlFor="name">Username</Label>
                      <Input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        placeholder="acmuser"
                      />
                    </div>
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
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                        placeholder="••••••••"
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Creating account…" : "Create account"}
                    </Button>
                  </form>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
