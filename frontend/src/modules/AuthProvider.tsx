import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, AuthUser, login as apiLogin, logout as apiLogout, me } from "./api";

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<AuthUser | null>;
  error: string | null;
  setError: (msg: string | null) => void;
  idleWarning: boolean;
  resetIdleTimer: () => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 Minuten
const WARNING_MS = 2 * 60 * 1000; // 2 Minuten vor Logout warnen

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
   const [idleWarning, setIdleWarning] = useState(false);
  const lastActiveRef = useRef<number>(Date.now());
  const warnTimerRef = useRef<number | null>(null);
  const logoutTimerRef = useRef<number | null>(null);

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
      clearIdleTimers();
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

  const clearIdleTimers = () => {
    if (warnTimerRef.current) window.clearTimeout(warnTimerRef.current);
    if (logoutTimerRef.current) window.clearTimeout(logoutTimerRef.current);
    warnTimerRef.current = null;
    logoutTimerRef.current = null;
  };

  const scheduleIdleTimers = () => {
    clearIdleTimers();
    const now = Date.now();
    lastActiveRef.current = now;
    setIdleWarning(false);
    warnTimerRef.current = window.setTimeout(() => {
      setIdleWarning(true);
    }, Math.max(0, IDLE_TIMEOUT_MS - WARNING_MS));
    logoutTimerRef.current = window.setTimeout(() => {
      autoLogout();
    }, IDLE_TIMEOUT_MS);
  };

  const handleActivity = () => {
    lastActiveRef.current = Date.now();
    scheduleIdleTimers();
  };

  const autoLogout = async () => {
    clearIdleTimers();
    try {
      await apiLogout();
    } catch {
      // ignore
    } finally {
      setUser(null);
      try {
        window.location.href = "/login?reason=idle";
      } catch {
        // ignore
      }
    }
  };

  useEffect(() => {
    if (!user) {
      clearIdleTimers();
      setIdleWarning(false);
      return;
    }
    scheduleIdleTimers();
    const reset = () => handleActivity();
    const checkVisibility = () => {
      if (document.visibilityState === "visible") {
        const elapsed = Date.now() - lastActiveRef.current;
        if (elapsed >= IDLE_TIMEOUT_MS) {
          autoLogout();
          return;
        }
        if (elapsed >= IDLE_TIMEOUT_MS - WARNING_MS) {
          setIdleWarning(true);
        }
      }
    };
    const events: (keyof DocumentEventMap)[] = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
    events.forEach((ev) => document.addEventListener(ev, reset, { passive: true }));
    document.addEventListener("visibilitychange", checkVisibility);
    return () => {
      events.forEach((ev) => document.removeEventListener(ev, reset));
      document.removeEventListener("visibilitychange", checkVisibility);
      clearIdleTimers();
    };
  }, [user]);

  const value = useMemo(
    () => ({ user, loading, login, logout, refresh, error, setError, idleWarning, resetIdleTimer: scheduleIdleTimers }),
    [user, loading, error, idleWarning]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
