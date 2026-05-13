import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useAuthClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandLogo } from "@/components/brand-logo";
import { privatePageMeta } from "@/lib/site-metadata";

export const Route = createFileRoute("/reset-password")({
  validateSearch: z.object({ token: z.string().optional() }),
  head: () => privatePageMeta("Reset password - Loadclass", "/reset-password"),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const authClient = useAuthClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm space-y-4 text-center">
          <p className="text-sm text-muted-foreground">Invalid or missing reset token.</p>
          <Link to="/forgot-password" className="text-sm text-primary hover:underline">
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setError(null);
    setLoading(true);
    const { error } = await authClient.resetPassword({ newPassword: password, token: token! });
    setLoading(false);
    if (error) {
      setError(error.message ?? "Reset failed — the link may have expired");
    } else {
      navigate({ to: "/login" });
    }
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
            <CardTitle>Reset password</CardTitle>
            <CardDescription>Choose a new password for your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <p className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                  {error.includes("expired") && (
                    <>
                      {" "}
                      <Link to="/forgot-password" className="underline">
                        Request a new link.
                      </Link>
                    </>
                  )}
                </p>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="password">New password</Label>
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
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Resetting…" : "Reset password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
