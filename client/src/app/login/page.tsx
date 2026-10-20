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

  const fillDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("Password123!");
    setFieldErrors({});
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white shadow-lg shadow-indigo-600/30 mb-2">
            <Briefcase className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Welcome back to TeamFlow</h1>
          <p className="text-sm text-slate-400">Sign in to manage projects and record visual bug reports</p>
        </div>

        <Card className="border-slate-800 bg-slate-900/90 shadow-2xl">
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle>Sign in to your account</CardTitle>
              <CardDescription>Enter your email and password below</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <Input
                label="Email Address"
                type="email"
                placeholder="developer@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={fieldErrors.email}
                required
                autoComplete="email"
              />

              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={fieldErrors.password}
                required
                autoComplete="current-password"
              />

              <Button
                type="submit"
                className="w-full mt-2"
                size="lg"
                isLoading={isLoading}
              >
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardContent>

            <CardFooter className="flex-col gap-4 text-center">
              <p className="text-xs text-slate-400">
                Don&apos;t have an account yet?{" "}
                <Link href="/register" className="text-indigo-400 hover:text-indigo-300 font-medium underline">
                  Create an account
                </Link>
              </p>

              {/* Demo Logins Section */}
              <div className="w-full pt-3 border-t border-slate-800">
                <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2">
                  Quick Demo Credentials (1-Click Sign In)
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => loginAsDemo("admin@teamflow.dev")}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-indigo-600 hover:text-white text-xs font-semibold text-slate-200 transition-all border border-slate-700/60 flex flex-col items-center justify-center gap-0.5 cursor-pointer disabled:opacity-50"
                  >
                    <span>Admin</span>
                    <span className="text-[10px] text-slate-400 font-normal">Full Access</span>
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => loginAsDemo("pm@teamflow.dev")}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-indigo-600 hover:text-white text-xs font-semibold text-slate-200 transition-all border border-slate-700/60 flex flex-col items-center justify-center gap-0.5 cursor-pointer disabled:opacity-50"
                  >
                    <span>PM</span>
                    <span className="text-[10px] text-slate-400 font-normal">Projects</span>
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => loginAsDemo("member@teamflow.dev")}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-indigo-600 hover:text-white text-xs font-semibold text-slate-200 transition-all border border-slate-700/60 flex flex-col items-center justify-center gap-0.5 cursor-pointer disabled:opacity-50"
                  >
                    <span>Member</span>
                    <span className="text-[10px] text-slate-400 font-normal">Bugs / Dev</span>
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
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center" />}>
      <LoginForm />
    </Suspense>
  );
}
