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
  login: (email: string, password: string, rememberMe?: boolean) => Promise<{
    user: User;
    organization: Organization | null;
    role: UserRole | null;
    token?: string;
  }>;
  register: (
    name: string,
    email: string,
    password: string,
    orgName?: string,
    inviteCode?: string,
    role?: UserRole
  ) => Promise<void>;
  createOrganization: (name: string) => Promise<{
    organization: Organization;
    role: UserRole;
    token?: string;
  }>;
  joinOrganization: (inviteCode: string) => Promise<{
    organization: Organization;
    role: UserRole;
    token?: string;
  }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  switchOrganization: (orgId: string) => Promise<void>;
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

      setUser((prev) => (JSON.stringify(prev) === JSON.stringify(data.user) ? prev : data.user));
      setOrganization((prev) => (JSON.stringify(prev) === JSON.stringify(data.organization) ? prev : data.organization));
      setRole((prev) => (prev === data.role ? prev : data.role));
      setAllOrganizations((prev) => (JSON.stringify(prev) === JSON.stringify(data.allOrganizations) ? prev : (data.allOrganizations || [])));
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
    const interval = setInterval(refreshUser, 60000); // 60s background sync
    return () => clearInterval(interval);
  }, [refreshUser]);

  const login = async (email: string, password: string, rememberMe = false) => {
    const res = await api.post<{
      user: User;
      organization: Organization | null;
      role: UserRole | null;
      token?: string;
    }>("/auth/login", { email, password, rememberMe });

    if (res.token) {
      api.setToken(res.token, rememberMe);
    }

    setUser(res.user);
    setOrganization(res.organization);
    setRole(res.role);
    await refreshUser();
    return res;
  };

  const createOrganization = async (name: string) => {
    const res = await api.post<{
      organization: Organization;
      role: UserRole;
      token?: string;
    }>("/organizations", { name });

    if (res.token) {
      api.setToken(res.token);
    }

    setOrganization(res.organization);
    setRole(res.role);
    await refreshUser();
    return res;
  };

  const joinOrganization = async (inviteCode: string) => {
    const res = await api.post<{
      organization: Organization;
      role: UserRole;
      token?: string;
    }>("/organizations/join", { inviteCode });

    if (res.token) {
      api.setToken(res.token);
    }

    setOrganization(res.organization);
    setRole(res.role);
    await refreshUser();
    return res;
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    orgName?: string,
    inviteCode?: string,
    role?: UserRole
  ) => {
    const res = await api.post<{
      user: User;
      organization: Organization;
      role: UserRole;
      token?: string;
    }>("/auth/register", { name, email, password, orgName, inviteCode, role });

    if (res.token) {
      api.setToken(res.token);
    }

    setUser(res.user);
    setOrganization(res.organization);
    setRole(res.role);
    await refreshUser();
  };

  const switchOrganization = async (orgId: string) => {
    const res = await api.post<{
      user: User;
      organization: Organization;
      role: UserRole;
      token?: string;
    }>("/auth/switch-org", { organizationId: orgId });

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
        createOrganization,
        joinOrganization,
        logout,
        refreshUser,
        switchOrganization,
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
