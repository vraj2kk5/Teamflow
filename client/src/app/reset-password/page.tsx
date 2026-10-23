"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiClientError } from "../../lib/api";
import { useToast } from "../../components/ui/Toast";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { PasswordInput } from "../../components/ui/PasswordInput";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../../components/ui/Card";
import { ShieldCheck, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlToken = searchParams.get("token") || "";

  const { error: toastError, success: toastSuccess } = useToast();

  const [token, setToken] = useState(urlToken);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<{
    token?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  const validate = () => {
    const errs: typeof fieldErrors = {};
    if (!token.trim()) errs.token = "Reset token is required";
    if (!newPassword) errs.newPassword = "New password is required";
    else if (newPassword.length < 8) errs.newPassword = "Password must be at least 8 characters";
    if (newPassword !== confirmPassword) {
      errs.confirmPassword = "Passwords do not match";
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      await api.post("/auth/reset-password", {
        token: token.trim(),
        newPassword,
      });

      setIsSuccess(true);
      toastSuccess("Password has been reset successfully!");
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Reset Failed");
      } else {
        toastError("Failed to reset password. The link or token may be expired.", "Error");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 transition-colors">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white shadow-lg shadow-indigo-600/30 mb-2">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Create New Password
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Set a strong and secure password for your account
          </p>
        </div>

        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
          {!isSuccess ? (
            <form onSubmit={handleSubmit}>
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-bold">Reset Password</CardTitle>
                <CardDescription>
                  Enter your verification token and your new password below
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Reset Token Input */}
                <Input
                  label="Reset Token"
                  placeholder="Paste your reset token here"
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value);
                    if (fieldErrors.token) setFieldErrors((prev) => ({ ...prev, token: undefined }));
                  }}
                  error={fieldErrors.token}
                  required
                  disabled={isLoading}
                />

                {/* New Password with Real-time Strength Meter & Conditions */}
                <PasswordInput
                  label="New Password"
                  placeholder="Enter a new strong password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (fieldErrors.newPassword) {
                      setFieldErrors((prev) => ({ ...prev, newPassword: undefined }));
                    }
                  }}
                  error={fieldErrors.newPassword}
                  showConditions
                  required
                  autoComplete="new-password"
                  disabled={isLoading}
                />

                {/* Confirm Password */}
                <PasswordInput
                  label="Confirm New Password"
                  placeholder="Re-enter your new password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (fieldErrors.confirmPassword) {
                      setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                    }
                  }}
                  error={fieldErrors.confirmPassword}
                  required
                  autoComplete="new-password"
                  disabled={isLoading}
                />

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full mt-2"
                  size="md"
                  isLoading={isLoading}
                >
                  <span>Update Password</span>
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </CardContent>

              <CardFooter className="justify-center pt-2">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </Link>
              </CardFooter>
            </form>
          ) : (
            <div>
              <CardHeader className="text-center pb-3">
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-2">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <CardTitle className="text-xl font-bold">Password Reset Complete</CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-400">
                  Your password has been securely updated. You can now log into your account using your new credentials.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3 pt-2">
                <Button
                  type="button"
                  variant="primary"
                  className="w-full"
                  size="md"
                  onClick={() => router.push("/login")}
                >
                  <span>Go to Sign In</span>
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </CardContent>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center" />
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
