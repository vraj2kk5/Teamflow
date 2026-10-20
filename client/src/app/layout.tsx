import "./globals.css";
import React from "react";
import type { Metadata } from "next";
import { AuthProvider } from "../contexts/AuthContext";
import { ToastProvider } from "../components/ui/Toast";
import { AppShell } from "../components/layout/AppShell";

export const metadata: Metadata = {
  title: "TeamFlow - Project Management & Visual Bug Reporting",
  description: "Modern team collaboration platform with screen and voice visual bug reporting.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen">
        <ToastProvider>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
