const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export type ApiError = Error & { status?: number };

export interface AuthUser {
  id: number;
  username: string;
  role_id?: number | null;
  role_name?: string | null;
  permissions?: string[];
}

export interface VersionInfo {
  version: string;
  build?: {
    sha?: string;
    time?: string;
    number?: number;
  };
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
    (err as any).data = data;
    if (res.status === 401) {
      try {
        window.dispatchEvent(new CustomEvent("auth-unauthorized"));
      } catch {
        // ignore
      }
    }
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

export async function changePassword(payload: { currentPassword: string; newPassword: string }) {
  return apiFetch<{ message: string }>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({
      oldPassword: payload.currentPassword,
      newPassword: payload.newPassword,
    }),
  });
}

export async function getVersion() {
  return apiFetch<VersionInfo>("/version");
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

export interface BankSettings {
  account_holder: string;
  bank_name: string;
  iban: string;
  bic: string;
  updated_at?: string | null;
}

export interface TaxSettings {
  tax_number: string | null;
  vat_id: string | null;
  updated_at?: string | null;
}

export interface DatevSettings {
  email: string | null;
  updated_at?: string | null;
}

export interface HkformsSettings {
  base_url: string;
  organization: string | null;
  has_api_key?: boolean;
  updated_at?: string | null;
}

export interface PdfSettings {
  storage_path: string;
  default_path?: string;
}

export interface EmailTemplateSettings {
  subject_template: string;
  body_html_template: string;
  body_text_template: string;
  updated_at?: string | null;
}

export interface FaviconSettings {
  filename: string | null;
  updated_at?: string | null;
  url?: string | null;
}

export interface NetworkSettings {
  cors_origins: string[];
  trust_proxy: boolean | number;
  updated_at?: string | null;
}

export interface NetworkDiagnostics {
  api: boolean;
  db: boolean;
  pdf_path_writable: boolean;
  smtp_config_present: boolean;
  cors_effective: string[];
  trust_proxy_effective: number | boolean;
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

export async function getBankSettings() {
  return apiFetch<BankSettings>("/settings/bank");
}

export async function updateBankSettings(payload: BankSettings) {
  return apiFetch<BankSettings>("/settings/bank", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getTaxSettings() {
  return apiFetch<TaxSettings>("/settings/tax");
}

export async function updateTaxSettings(payload: TaxSettings) {
  return apiFetch<TaxSettings>("/settings/tax", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getDatevSettings() {
  return apiFetch<DatevSettings>("/settings/datev");
}

export async function updateDatevSettings(payload: DatevSettings) {
  return apiFetch<DatevSettings>("/settings/datev", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getHkformsSettings() {
  return apiFetch<HkformsSettings>("/settings/hkforms");
}

export async function updateHkformsSettings(payload: { base_url?: string; organization?: string | null; api_key?: string }) {
  return apiFetch<HkformsSettings>("/settings/hkforms", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function testHkforms(payload: { base_url?: string; organization?: string | null; api_key?: string }) {
  return apiFetch<{ ok: boolean; status?: number; url?: string; message?: string; details?: any }>(
    "/settings/hkforms/test",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function getPdfSettings() {
  return apiFetch<PdfSettings>("/settings/pdf");
}

export async function updatePdfSettings(payload: { storage_path: string }) {
  return apiFetch<PdfSettings & { message: string }>("/settings/pdf", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function testPdfPath(payload: { path: string }) {
  return apiFetch<{ ok: boolean; path: string }>("/settings/pdf/test-path", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getEmailTemplates() {
  return apiFetch<EmailTemplateSettings>("/settings/email-templates");
}

export async function saveEmailTemplates(payload: {
  subject_template: string;
  body_html_template?: string | null;
  body_text_template?: string | null;
}) {
  return apiFetch<EmailTemplateSettings>("/settings/email-templates", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getFaviconSettings() {
  return apiFetch<FaviconSettings>("/settings/favicon");
}

export async function uploadFavicon(payload: { data_url: string }) {
  return apiFetch<FaviconSettings & { ok: boolean }>("/settings/favicon", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function resetFavicon() {
  return apiFetch<FaviconSettings & { ok: boolean }>("/settings/favicon/reset", {
    method: "POST",
  });
}

export async function getNetworkSettings() {
  return apiFetch<NetworkSettings>("/settings/network");
}

export async function updateNetworkSettings(payload: { cors_origins: string[]; trust_proxy: boolean | number }) {
  return apiFetch<NetworkSettings & { message?: string }>("/settings/network", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getNetworkDiagnostics() {
  return apiFetch<NetworkDiagnostics>("/settings/network/diagnostics");
}

export async function regenerateInvoicePdf(id: number) {
  return apiFetch<{ message: string; filename: string; path: string; size?: number | null }>(
    `/invoices/${id}/pdf/regenerate`,
    { method: "POST" }
  );
}

export interface ApiKeyInfo {
  id: number;
  name: string | null;
  prefix: string;
  scopes?: any;
  created_at: string;
  last_used_at?: string | null;
  revoked_at?: string | null;
}

export async function listApiKeys() {
  return apiFetch<ApiKeyInfo[]>("/settings/api-keys");
}

export async function createApiKey(payload: { name?: string | null; scopes?: any }) {
  return apiFetch<ApiKeyInfo & { api_key: string }>("/settings/api-keys", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function rotateApiKey(id: number) {
  return apiFetch<ApiKeyInfo & { api_key: string }>(`/settings/api-keys/${id}/rotate`, {
    method: "POST",
  });
}

export async function revokeApiKey(id: number) {
  return apiFetch<{ message: string }>(`/settings/api-keys/${id}/revoke`, {
    method: "POST",
  });
}

export async function deleteApiKey(id: number) {
  return apiFetch<{ message: string }>(`/settings/api-keys/${id}`, {
    method: "DELETE",
  });
}

// Stats
export interface InvoiceStatsResponse {
  overall: {
    count: number;
    sum_total: number;
    sum_net: number;
    sum_tax: number;
    paid_count: number;
    unpaid_count: number;
    sent_unpaid_count?: number;
    paid_sum: number;
    unpaid_sum: number;
    outstanding_sum: number;
    sent_unpaid_sum?: number;
    avg_value: number;
    currency: string;
  };
  byYear: {
    year: number;
    count: number;
    sum_total: number;
    sum_net: number;
    sum_tax: number;
    paid_sum: number;
    unpaid_sum: number;
    outstanding_sum: number;
    sent_unpaid_sum?: number;
    paid_count: number;
    unpaid_count: number;
    avg_value: number;
    currency: string;
  }[];
  byMonth?: {
    year: number;
    month: number;
    count: number;
    sum_total: number;
    paid_sum: number;
    unpaid_sum: number;
    sent_unpaid_sum?: number;
  }[];
  categories: { key: string; label: string }[];
  topCustomers?: { name: string; sum_total: number; count: number }[];
  topCategories?: { key: string | null; label: string; sum_total: number; count: number }[];
}

export async function getInvoiceStats(params?: { year?: number; categories?: string[] }) {
  const qs: string[] = [];
  if (params?.year) qs.push(`year=${encodeURIComponent(params.year)}`);
  if (params?.categories?.length) qs.push(`category=${encodeURIComponent(params.categories.join(","))}`);
  const query = qs.length ? `?${qs.join("&")}` : "";
  return apiFetch<InvoiceStatsResponse>(`/stats/invoices${query}`);
}

// Customers / Recipients
export interface Customer {
  id: number;
  name: string;
  street?: string | null;
  zip?: string | null;
  city?: string | null;
  email?: string | null;
  phone?: string | null;
}

export async function listCustomers() {
  return apiFetch<Customer[]>("/customers");
}

export async function createCustomer(payload: Omit<Customer, "id">) {
  return apiFetch<{ id: number }>("/customers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCustomer(id: number, payload: Omit<Customer, "id">) {
  return apiFetch<{ message: string }>(`/customers/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteCustomer(id: number) {
  return apiFetch<{ message: string }>(`/customers/${id}`, {
    method: "DELETE",
  });
}

// Invoices
export interface InvoiceListItem {
  id: number;
  invoice_number: string;
  date: string;
  recipient_name: string | null;
  recipient_email: string | null;
  category_id: number | null;
  category_label: string | null;
  status_sent?: boolean | null;
  status_sent_at?: string | null;
  status_paid_at?: string | null;
  gross_total?: number | null;
  canceled_at?: string | null;
  cancel_reason?: string | null;
   datev_export_status?: string | null;
   datev_exported_at?: string | null;
   datev_export_error?: string | null;
}

export interface InvoiceDetail {
  invoice: {
    id: number;
    invoice_number: string;
    date: string;
    category: string | null;
    reservation_request_id?: string | null;
    external_reference?: string | null;
    receipt_date?: string | null;
    status_sent?: boolean | null;
    status_sent_at?: string | null;
    status_paid_at?: string | null;
    overdue_since?: string | null;
    datev_export_status?: string | null;
    datev_exported_at?: string | null;
    datev_export_error?: string | null;
    net_19?: number | null;
    vat_19?: number | null;
    gross_19?: number | null;
    net_7?: number | null;
    vat_7?: number | null;
    gross_7?: number | null;
    gross_total?: number | null;
    b2b?: boolean | null;
    ust_id?: string | null;
    canceled_at?: string | null;
    cancel_reason?: string | null;
    recipient: Customer & { id: number | null };
  };
  items: InvoiceItem[];
  pdf?: {
    url?: string | null;
    filename?: string | null;
    location?: string | null;
    size?: number | null;
  };
}

export interface InvoiceItem {
  id?: number;
  description: string;
  quantity: number;
  unit_price_gross: number;
  vat_key: number;
  line_total_gross?: number;
}

export interface RecentInvoice {
  id: number;
  invoice_number: string;
  date: string | null;
  recipient_name: string | null;
  category_label: string | null;
  status_sent?: boolean | null;
  status_sent_at?: string | null;
  status_paid_at?: string | null;
  gross_total?: number | null;
}

export async function listInvoices(params?: {
  from?: string;
  to?: string;
  customer?: string;
  status?: string[];
  category?: string;
  limit?: number;
}) {
  const qs: string[] = [];
  if (params?.from) qs.push(`from=${encodeURIComponent(params.from)}`);
  if (params?.to) qs.push(`to=${encodeURIComponent(params.to)}`);
  if (params?.customer) qs.push(`customer=${encodeURIComponent(params.customer)}`);
  if (params?.status?.length) qs.push(`status=${encodeURIComponent(params.status.join(","))}`);
  if (params?.category) qs.push(`category=${encodeURIComponent(params.category)}`);
  if (params?.limit) qs.push(`limit=${encodeURIComponent(String(params.limit))}`);
  const query = qs.length ? `?${qs.join("&")}` : "";
  return apiFetch<InvoiceListItem[]>(`/invoices${query}`);
}

export async function listRecentInvoices(limit = 10) {
  const qs = limit ? `?limit=${encodeURIComponent(limit)}` : "";
  return apiFetch<RecentInvoice[]>(`/invoices/recent${qs}`);
}

export async function getInvoice(id: number) {
  return apiFetch<InvoiceDetail>(`/invoices/${id}`);
}

export async function getNextInvoiceNumber() {
  return apiFetch<{ next_number: string }>("/invoices/next-number");
}

export async function createInvoice(payload: {
  recipient: Partial<Customer>;
  invoice: any;
  items: InvoiceItem[];
}) {
  return apiFetch<{ invoice_id: number }>(`/invoices`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateInvoice(id: number, payload: {
  recipient: Partial<Customer>;
  invoice: any;
  items: InvoiceItem[];
}) {
  return apiFetch<{ message: string }>(`/invoices/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteInvoice(id: number) {
  return apiFetch<{ message: string }>(`/invoices/${id}`, {
    method: "DELETE",
  });
}

export async function bulkCancelInvoices(ids: number[], reason?: string) {
  return apiFetch<{ updated: number }>(`/invoices/bulk-cancel`, {
    method: "POST",
    body: JSON.stringify({ ids, reason }),
  });
}

export async function markInvoiceSent(id: number) {
  return apiFetch<{ message?: string }>(`/invoices/${id}/status/sent`, { method: "POST" });
}

export async function markInvoicePaid(id: number) {
  return apiFetch<{ message?: string }>(`/invoices/${id}/status/paid`, { method: "POST" });
}

export async function getInvoiceEmailPreview(id: number) {
  return apiFetch<{
    subject: string;
    body_html: string;
    body_text: string;
    from: string | null;
    smtp_ready: boolean;
    using_category_account: boolean;
    datev_email?: string | null;
    datev_configured?: boolean;
  }>(`/invoices/${id}/email-preview`);
}

export async function sendInvoiceEmailApi(id: number, payload: { to: string; subject?: string; message?: string; html?: string; include_datev?: boolean }) {
  return apiFetch<{ message: string }>(`/invoices/${id}/send-email`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function exportInvoiceDatev(id: number) {
  return apiFetch<{ message: string }>(`/invoices/${id}/datev-export`, {
    method: "POST",
  });
}

// Users
export interface User {
  id: number;
  username: string;
  role_id: number | null;
  role_name?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
}

export async function listUsers() {
  return apiFetch<User[]>("/users");
}

export async function createUserApi(payload: { username: string; password: string; role_id?: number | null }) {
  return apiFetch<User>("/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateUserApi(id: number, payload: { username?: string; role_id?: number | null; is_active?: boolean }) {
  return apiFetch<User>(`/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteUserApi(id: number) {
  return apiFetch<{ message: string }>(`/users/${id}`, { method: "DELETE" });
}

// Roles
export interface Role {
  id: number;
  name: string;
  description?: string | null;
}

export async function listRoles() {
  return apiFetch<Role[]>("/roles");
}

export async function getRolePermissionsApi(id: number) {
  return apiFetch<string[]>(`/roles/${id}/permissions`);
}

export async function createRoleApi(payload: { name: string; description?: string | null; permissions?: string[] }) {
  return apiFetch<Role>("/roles", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateRoleApi(id: number, payload: { name: string; description?: string | null; permissions?: string[] }) {
  return apiFetch<{ message: string }>(`/roles/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteRoleApi(id: number) {
  return apiFetch<{ message: string }>(`/roles/${id}`, { method: "DELETE" });
}

// Categories
export interface Category {
  id: number;
  key: string;
  label: string;
  logo_file: string | null;
  email_account?: CategoryEmailAccount | null;
  template?: CategoryTemplate | null;
}

export interface CategoryEmailAccount {
  id: number | null;
  display_name: string | null;
  email_address: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_secure: boolean | null;
  smtp_user: string | null;
}

export interface CategoryTemplate {
  id: number;
  category_id?: number;
  subject: string;
  body_html: string;
}

export async function listCategories() {
  return apiFetch<Category[]>("/categories");
}

export async function listCategoryLogos() {
  return apiFetch<string[]>("/categories/logos");
}

export async function uploadCategoryLogo(filename: string, dataUrl: string) {
  return apiFetch<{ filename: string; size: number }>("/categories/logo", {
    method: "POST",
    body: JSON.stringify({ filename, dataUrl }),
  });
}

export async function createCategory(payload: { key: string; label: string; logo_file: string }) {
  return apiFetch<Category>("/categories", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCategory(id: number, payload: { key: string; label: string; logo_file: string }) {
  return apiFetch<Category>(`/categories/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteCategory(id: number) {
  return apiFetch<{ message: string }>(`/categories/${id}`, { method: "DELETE" });
}

export async function getCategoryTemplateApi(id: number) {
  return apiFetch<CategoryTemplate | null>(`/categories/${id}/template`);
}

export async function saveCategoryTemplateApi(id: number, payload: { subject: string; body_html: string }) {
  return apiFetch<CategoryTemplate>(`/categories/${id}/template`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getCategoryEmailApi(id: number) {
  return apiFetch<CategoryEmailAccount | null>(`/categories/${id}/email`);
}

export async function saveCategoryEmailApi(id: number, payload: Partial<CategoryEmailAccount> & { smtp_pass?: string }) {
  return apiFetch<CategoryEmailAccount>(`/categories/${id}/email`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function testCategoryEmailApi(id: number, payload: Partial<CategoryEmailAccount> & { smtp_pass?: string }) {
  return apiFetch<{ ok: boolean; message?: string }>(`/categories/${id}/email/test`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
