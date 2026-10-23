"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../components/ui/Toast";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../../components/ui/Card";
import { Briefcase, ArrowRight, Building, KeyRound } from "lucide-react";
import { ApiClientError } from "../../lib/api";
import { cn } from "../../lib/utils";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();

  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    orgName?: string;
    inviteCode?: string;
  }>({});

  const validate = () => {
    const errs: typeof fieldErrors = {};
    if (!name.trim()) errs.name = "Full name is required";
    if (!email.trim()) errs.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = "Invalid email format";
    if (!password) errs.password = "Password is required";
    else if (password.length < 8) errs.password = "Password must be at least 8 characters";

    if (mode === "create") {
      if (!orgName.trim()) errs.orgName = "Organization name is required";
    } else {
      if (!inviteCode.trim()) errs.inviteCode = "Invite code is required";
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      await register(
        name.trim(),
        email.trim(),
        password,
        mode === "create" ? orgName.trim() : undefined,
        mode === "join" ? inviteCode.trim().toUpperCase() : undefined
      );

      toastSuccess(
        mode === "create"
          ? "Account and organization created successfully!"
          : "Successfully joined organization!"
      );
      router.push("/dashboard");
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.details) {
          const newErrs: typeof fieldErrors = {};
          err.details.forEach((d) => {
            if (d.field) (newErrs as Record<string, string>)[d.field] = d.message;
          });
          setFieldErrors(newErrs);
        }
        toastError(err.message, "Registration Failed");
      } else {
        toastError("Failed to register account. Please try again.", "Error");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 transition-colors">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white shadow-lg shadow-indigo-600/30 mb-2">
            <Briefcase className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Create your TeamFlow account
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Collaborate with your engineering team and report bugs visually
          </p>
        </div>

        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
          <form onSubmit={handleSubmit}>
            <CardHeader className="space-y-3 pb-4">
              <div>
                <CardTitle className="text-xl font-bold">Sign Up</CardTitle>
                <CardDescription className="mt-0.5">Fill out your details to get started</CardDescription>
              </div>

              {/* Mode Toggle Tabs */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setMode("create")}
                  className={cn(
                    "flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg transition-all",
                    mode === "create"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  )}
                >
                  <Building className="w-3.5 h-3.5" />
                  <span>Create Organization</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("join")}
                  className={cn(
                    "flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg transition-all",
                    mode === "join"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  )}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Join with Invite Code</span>
                </button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <Input
                label="Full Name"
                placeholder="Ada Lovelace"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={fieldErrors.name}
                required
                autoComplete="name"
              />

              <Input
                label="Email Address"
                type="email"
                placeholder="ada@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={fieldErrors.email}
                required
                autoComplete="email"
              />

              <Input
                label="Password (min 8 chars)"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={fieldErrors.password}
                required
                autoComplete="new-password"
              />

              {mode === "create" ? (
                <Input
                  label="Organization Name"
                  placeholder="Acme Engineering"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  error={fieldErrors.orgName}
                  helperText="You will be registered as the ADMIN of this organization"
                  required
                />
              ) : (
                <Input
                  label="Organization Invite Code"
                  placeholder="e.g. TF-A1B2C3D4"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  error={fieldErrors.inviteCode}
                  helperText="Ask your Admin or PM for your team's invite code"
                  required
                />
              )}

              <Button
                type="submit"
                className="w-full mt-2"
                size="lg"
                isLoading={isLoading}
              >
                <span>{mode === "create" ? "Create Organization & Account" : "Join & Create Account"}</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardContent>

            <CardFooter className="justify-center text-center">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Already have an account?{" "}
                <Link href="/login" className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold">
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
