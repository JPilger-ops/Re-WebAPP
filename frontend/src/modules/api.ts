const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export type ApiError = Error & { status?: number };

export interface AuthUser {
  id: number;
  username: string;
  role_id?: number | null;
  role_name?: string | null;
  permissions?: string[];
}

async function parseJsonSafe(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

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
    const data = await parseJsonSafe(res);
    const text = data?.message || data?.error || (typeof data === "string" ? data : "") || (await res.text());
    const err: ApiError = new Error(text || `Request failed with ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

export async function login(username: string, password: string) {
  return apiFetch<{ message: string; user: AuthUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function logout() {
  return apiFetch<{ message: string }>("/auth/logout", { method: "POST" });
}

export async function me() {
  return apiFetch<AuthUser>("/auth/me");
}

// Settings APIs
export interface SmtpSettings {
  host: string | null;
  port: number | null;
  secure: boolean;
  user: string | null;
  from: string | null;
  reply_to: string | null;
  has_password?: boolean;
  updated_at?: string | null;
}

export interface InvoiceHeaderSettings {
  company_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  zip: string | null;
  city: string | null;
  country: string | null;
  vat_id: string | null;
  bank_name: string | null;
  iban: string | null;
  bic: string | null;
  footer_text: string | null;
  logo_url: string | null;
  updated_at?: string | null;
}

export async function getSmtpSettings() {
  return apiFetch<SmtpSettings>("/settings/smtp");
}

export async function updateSmtpSettings(payload: Partial<SmtpSettings> & { password?: string }) {
  return apiFetch<SmtpSettings & { message: string }>("/settings/smtp", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function testSmtp(to: string) {
  return apiFetch<{ ok: boolean; dry_run: boolean; redirected: boolean; to: string; message?: string }>(
    "/settings/smtp/test",
    {
      method: "POST",
      body: JSON.stringify({ to }),
    }
  );
}

export async function getInvoiceHeader() {
  return apiFetch<InvoiceHeaderSettings>("/settings/invoice-header");
}

export async function updateInvoiceHeader(payload: Partial<InvoiceHeaderSettings>) {
  return apiFetch<InvoiceHeaderSettings & { message: string }>("/settings/invoice-header", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
