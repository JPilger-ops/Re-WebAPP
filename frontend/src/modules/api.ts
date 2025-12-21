const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export type ApiError = Error & { status?: number };

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    const err: ApiError = new Error(text || `Request failed with ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

export async function login(username: string, password: string) {
  return apiFetch<{ message: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function logout() {
  return apiFetch<{ message: string }>("/auth/logout", { method: "POST" });
}

export async function me() {
  return apiFetch<{ username: string }>("/auth/me");
}
