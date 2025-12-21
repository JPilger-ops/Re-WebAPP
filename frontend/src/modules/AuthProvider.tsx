import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ApiError, AuthUser, login as apiLogin, logout as apiLogout, me } from "./api";

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<AuthUser | null>;
  error: string | null;
  setError: (msg: string | null) => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    me()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    setError(null);
    const res = await apiLogin(username, password);
    const current = await me();
    setUser(current);
    return current;
  };

  const logout = async () => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
    }
  };

  const refresh = async () => {
    try {
      const u = await me();
      setUser(u);
      return u;
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 401) {
        setUser(null);
      }
      return null;
    }
  };

  const value = useMemo(
    () => ({ user, loading, login, logout, refresh, error, setError }),
    [user, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
