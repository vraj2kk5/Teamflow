"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../components/ui/Toast";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../../components/ui/Card";
import { Briefcase, ArrowRight } from "lucide-react";
import { ApiClientError } from "../../lib/api";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || "/dashboard";

  const { login } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const errs: { email?: string; password?: string } = {};
    if (!email.trim()) errs.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = "Invalid email format";
    if (!password) errs.password = "Password is required";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      await login(email.trim(), password);
      toastSuccess("Logged in successfully!");
      router.push(nextUrl);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Login Failed");
      } else {
        toastError("Unable to authenticate. Please check your credentials.", "Error");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loginAsDemo = async (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("Password123!");
    setFieldErrors({});
    setIsLoading(true);
    try {
      await login(demoEmail, "Password123!");
      toastSuccess(`Signed in as ${demoEmail.split("@")[0]}!`);
      router.push(nextUrl);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Login Failed");
      } else {
        toastError("Unable to authenticate.", "Error");
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
            <Briefcase className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Welcome back to TeamFlow
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Sign in to manage projects and record visual bug reports
          </p>
        </div>

        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
          <form onSubmit={handleSubmit}>
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-bold">Sign in to your account</CardTitle>
              <CardDescription>Enter your email and password below</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <Input
                label="Email Address"
                type="email"
                placeholder="developer@company.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }}
                error={fieldErrors.email}
                required
                autoComplete="email"
                disabled={isLoading}
              />

              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                }}
                error={fieldErrors.password}
                required
                autoComplete="current-password"
                disabled={isLoading}
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full mt-2"
                size="md"
                isLoading={isLoading}
              >
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4 pt-2">
              <p className="text-xs text-center text-slate-600 dark:text-slate-400">
                Don&apos;t have an account yet?{" "}
                <Link
                  href="/register"
                  className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Create an account
                </Link>
              </p>

              {/* Quick Demo Credentials */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 w-full space-y-2">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">
                  Quick Demo Credentials (1-Click Sign In)
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => loginAsDemo("admin@teamflow.dev")}
                    className="p-2 rounded-lg bg-slate-100 hover:bg-indigo-600 hover:text-white dark:bg-slate-800 dark:hover:bg-indigo-600 dark:hover:text-white text-xs font-semibold text-slate-800 dark:text-slate-200 transition-all border border-slate-200 dark:border-slate-700/60 flex flex-col items-center justify-center gap-0.5 cursor-pointer disabled:opacity-50"
                  >
                    <span>Admin</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">Full Access</span>
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => loginAsDemo("pm@teamflow.dev")}
                    className="p-2 rounded-lg bg-slate-100 hover:bg-indigo-600 hover:text-white dark:bg-slate-800 dark:hover:bg-indigo-600 dark:hover:text-white text-xs font-semibold text-slate-800 dark:text-slate-200 transition-all border border-slate-200 dark:border-slate-700/60 flex flex-col items-center justify-center gap-0.5 cursor-pointer disabled:opacity-50"
                  >
                    <span>PM</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">Projects</span>
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => loginAsDemo("member@teamflow.dev")}
                    className="p-2 rounded-lg bg-slate-100 hover:bg-indigo-600 hover:text-white dark:bg-slate-800 dark:hover:bg-indigo-600 dark:hover:text-white text-xs font-semibold text-slate-800 dark:text-slate-200 transition-all border border-slate-200 dark:border-slate-700/60 flex flex-col items-center justify-center gap-0.5 cursor-pointer disabled:opacity-50"
                  >
                    <span>Member</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">Bugs / Dev</span>
                  </button>
                </div>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center" />}>
      <LoginForm />
    </Suspense>
  );
}
