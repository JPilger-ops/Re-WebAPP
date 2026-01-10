import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ApiError, AuthUser, login as apiLogin, logout as apiLogout, me } from "./api";

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string, otp?: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<AuthUser | null>;
  error: string | null;
  setError: (msg: string | null) => void;
  idleWarning: boolean;
  resetIdleTimer: () => void;
  idleMsRemaining: number;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 Minuten
const WARNING_MS = 60 * 1000; // 1 Minute vor Logout warnen

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [idleWarning, setIdleWarning] = useState(false);
  const [idleMsRemaining, setIdleMsRemaining] = useState(IDLE_TIMEOUT_MS);
  const lastActiveRef = useRef<number>(Date.now());
  const warnTimerRef = useRef<number | null>(null);
  const logoutTimerRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    me()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const clearIdleTimers = useCallback(() => {
    if (warnTimerRef.current) window.clearTimeout(warnTimerRef.current);
    if (logoutTimerRef.current) window.clearTimeout(logoutTimerRef.current);
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    warnTimerRef.current = null;
    logoutTimerRef.current = null;
    intervalRef.current = null;
  }, []);

  const autoLogout = useCallback(async () => {
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
  }, [clearIdleTimers]);

  const scheduleIdleTimers = useCallback(() => {
    clearIdleTimers();
    const now = Date.now();
    lastActiveRef.current = now;
    setIdleWarning(false);
    setIdleMsRemaining(IDLE_TIMEOUT_MS);
    intervalRef.current = window.setInterval(() => {
      const remaining = Math.max(0, IDLE_TIMEOUT_MS - (Date.now() - lastActiveRef.current));
      setIdleMsRemaining(remaining);
      if (remaining <= 0) {
        autoLogout();
      } else if (remaining <= WARNING_MS) {
        setIdleWarning(true);
      }
    }, 1000);
    warnTimerRef.current = window.setTimeout(() => {
      setIdleWarning(true);
    }, Math.max(0, IDLE_TIMEOUT_MS - WARNING_MS));
    logoutTimerRef.current = window.setTimeout(() => {
      autoLogout();
    }, IDLE_TIMEOUT_MS);
  }, [autoLogout, clearIdleTimers]);

  const handleActivity = useCallback(() => {
    lastActiveRef.current = Date.now();
    scheduleIdleTimers();
  }, [scheduleIdleTimers]);

  const login = useCallback(async (username: string, password: string, otp?: string) => {
    setError(null);
    const res = await apiLogin(username, password, otp);
    const current = await me();
    setUser(current);
    return current;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
      clearIdleTimers();
    }
  }, [clearIdleTimers]);

  const refresh = useCallback(async () => {
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
  }, []);

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
  }, [autoLogout, clearIdleTimers, handleActivity, scheduleIdleTimers, user]);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      refresh,
      error,
      setError,
      idleWarning,
      resetIdleTimer: scheduleIdleTimers,
      idleMsRemaining,
    }),
    [user, loading, login, logout, refresh, error, setError, idleWarning, scheduleIdleTimers, idleMsRemaining]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
