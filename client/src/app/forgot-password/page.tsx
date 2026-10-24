"use client";

import React, { useState } from "react";
import Link from "next/link";
import { api, ApiClientError } from "../../lib/api";
import { useToast } from "../../components/ui/Toast";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../../components/ui/Card";
import {
  KeyRound,
  ArrowLeft,
  Mail,
  ShieldCheck,
  Clock,
  RotateCcw,
} from "lucide-react";

interface ForgotPasswordResponse {
  message: string;
  email: string;
}

export default function ForgotPasswordPage() {
  const { error: toastError, success: toastSuccess } = useToast();

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [result, setResult] = useState<ForgotPasswordResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setFieldError("Email is required");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setFieldError("Invalid email address format");
      return;
    }

    setFieldError(undefined);
    setIsLoading(true);

    try {
      const res = await api.post<ForgotPasswordResponse>("/auth/forgot-password", {
        email: email.trim().toLowerCase(),
      });
      setResult(res);
      toastSuccess("Password reset instructions sent to your email!");
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Request Failed");
      } else {
        toastError("Failed to initiate password reset. Please try again.", "Error");
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
            <KeyRound className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Forgot Password?
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Enter your email to receive secure password reset instructions
          </p>
        </div>

        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
          {!result ? (
            <form onSubmit={handleSubmit}>
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-bold">Find your account</CardTitle>
                <CardDescription>
                  Enter the email address associated with your TeamFlow account
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="developer@company.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldError) setFieldError(undefined);
                  }}
                  error={fieldError}
                  required
                  autoComplete="email"
                  disabled={isLoading}
                />

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full mt-2"
                  size="md"
                  isLoading={isLoading}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  <span>Send Reset Link</span>
                </Button>
              </CardContent>

              <CardFooter className="flex justify-center pt-2">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </Link>
              </CardFooter>
            </form>
          ) : (
            <div>
              <CardHeader className="pb-3 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-2">
                  <Mail className="w-6 h-6" />
                </div>
                <CardTitle className="text-xl font-bold">Check Your Email</CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-400">
                  If an account exists for{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-200">
                    {result.email}
                  </span>
                  , a secure reset link has been dispatched to your inbox.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 pt-2">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <p>
                      For your protection, reset links are delivered out-of-band to the registered
                      inbox and expire in 1 hour.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Clock className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                    <p>
                      Open the link in your email to choose a new password. If you don&apos;t see the email,
                      check your spam folder.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
                    💡 <span className="font-medium">Local Dev Mode:</span> Simulated email with the one-time link is logged to your backend server terminal.
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  size="md"
                  onClick={() => {
                    setResult(null);
                    setEmail("");
                  }}
                >
                  <RotateCcw className="w-4 h-4 mr-1.5" />
                  <span>Try another email</span>
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
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
