"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, ApiClientError } from "../lib/api";

export type UserRole = "ADMIN" | "PROJECT_MANAGER" | "MEMBER";

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  jobTitle?: string | null;
  bio?: string | null;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  inviteCode?: string | null;
}

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  role: UserRole | null;
  allOrganizations: (Organization & { role: UserRole })[];
  isLoading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    orgName?: string,
    inviteCode?: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [allOrganizations, setAllOrganizations] = useState<(Organization & { role: UserRole })[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const data = await api.get<{
        user: User;
        organization: Organization | null;
        role: UserRole | null;
        allOrganizations: (Organization & { role: UserRole })[];
      }>("/auth/me");

      setUser(data.user);
      setOrganization(data.organization);
      setRole(data.role);
      setAllOrganizations(data.allOrganizations || []);
    } catch {
      setUser(null);
      setOrganization(null);
      setRole(null);
      setAllOrganizations([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string, rememberMe = false) => {
    const res = await api.post<{
      user: User;
      organization: Organization;
      role: UserRole;
      token?: string;
    }>("/auth/login", { email, password, rememberMe });

    if (res.token) {
      api.setToken(res.token, rememberMe);
    }

    setUser(res.user);
    setOrganization(res.organization);
    setRole(res.role);
    await refreshUser();
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    orgName?: string,
    inviteCode?: string
  ) => {
    const res = await api.post<{
      user: User;
      organization: Organization;
      role: UserRole;
      token?: string;
    }>("/auth/register", { name, email, password, orgName, inviteCode });

    if (res.token) {
      api.setToken(res.token);
    }

    setUser(res.user);
    setOrganization(res.organization);
    setRole(res.role);
    await refreshUser();
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      api.clearToken();
      setUser(null);
      setOrganization(null);
      setRole(null);
      setAllOrganizations([]);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        role,
        allOrganizations,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
