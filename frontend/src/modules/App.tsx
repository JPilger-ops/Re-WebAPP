import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, Link, Outlet, useParams, useSearchParams } from "react-router-dom";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError,
  ApiKeyInfo,
  Customer,
  Category,
  InvoiceDetail,
  InvoiceItem,
  InvoiceListItem,
  RecentInvoice,
  BankSettings,
  TaxSettings,
  DatevSettings,
  HkformsSettings,
  InvoiceStatsResponse,
  VersionInfo,
  User,
  Role,
  BackupSettings,
  BackupSummary,
  getInvoiceHeader,
  getSmtpSettings,
  getNetworkSettings,
  updateNetworkSettings,
  getNetworkDiagnostics,
  getBackupSettings,
  updateBackupSettings,
  testBackupPathApi,
  mountNfsShare,
  listBackups,
  createBackupApi,
  restoreBackupApi,
  deleteBackupApi,
  backupDownloadUrl,
  invoicesArchiveUrl,
  login as apiLogin,
  testSmtp,
  updateInvoiceHeader,
  updateSmtpSettings,
  getBankSettings,
  updateBankSettings,
  getTaxSettings,
  updateTaxSettings,
  getDatevSettings,
  updateDatevSettings,
  getHkformsSettings,
  updateHkformsSettings,
  testHkforms,
  changePassword,
  getInvoiceStats,
  regenerateInvoicePdf,
  listApiKeys,
  createApiKey,
  rotateApiKey,
  revokeApiKey,
  deleteApiKey,
  listRecentInvoices,
  getPdfSettings,
  updatePdfSettings,
  testPdfPath,
  listInvoices,
  getInvoice,
  getNextInvoiceNumber,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  bulkCancelInvoices,
  listCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  listCategories,
  listCategoryLogos,
  uploadCategoryLogo,
  createCategory as apiCreateCategory,
  updateCategory as apiUpdateCategory,
  deleteCategory as apiDeleteCategory,
  getCategoryTemplateApi,
  saveCategoryTemplateApi,
  getCategoryEmailApi,
  saveCategoryEmailApi,
  testCategoryEmailApi,
  markInvoicePaid,
  markInvoiceSent,
  getInvoiceEmailPreview,
  sendInvoiceEmailApi,
  exportInvoiceDatev,
  getVersion,
  listUsers,
  createUserApi,
  updateUserApi,
  deleteUserApi,
  listRoles,
  getRolePermissionsApi,
  createRoleApi,
  updateRoleApi,
  deleteRoleApi,
  getEmailTemplates,
  saveEmailTemplates,
  getFaviconSettings,
  uploadFavicon,
  resetFavicon,
  uploadCaCertificate,
  getMfaStatus,
  startMfaSetup,
  verifyMfaSetup,
  disableMfa,
} from "./api";
import { API_BASE } from "./api";
import { AuthProvider, useAuth } from "./AuthProvider";
import { Alert, Button, Checkbox, Confirm, EmptyState, Input, Modal, Spinner, Textarea, Badge, SidebarLink, Select, MoreMenu } from "./ui";

type FormStatus = { type: "success" | "error" | "info"; message: string } | null;

const PERMISSION_OPTIONS: { key: string; label: string }[] = [
  { key: "invoices.read", label: "Rechnungen lesen" },
  { key: "invoices.create", label: "Rechnungen erstellen" },
  { key: "invoices.update", label: "Rechnungen bearbeiten" },
  { key: "invoices.export", label: "Rechnungen exportieren" },
  { key: "invoices.delete", label: "Rechnungen löschen" },
  { key: "stats.view", label: "Statistiken ansehen" },
  { key: "customers.read", label: "Kunden lesen" },
  { key: "customers.create", label: "Kunden anlegen" },
  { key: "customers.update", label: "Kunden bearbeiten" },
  { key: "customers.delete", label: "Kunden löschen" },
  { key: "users.read", label: "Benutzer lesen" },
  { key: "users.create", label: "Benutzer anlegen" },
  { key: "users.update", label: "Benutzer bearbeiten" },
  { key: "users.delete", label: "Benutzer löschen" },
  { key: "users.resetPassword", label: "Benutzer-Passwort zurücksetzen" },
  { key: "roles.read", label: "Rollen lesen" },
  { key: "roles.create", label: "Rollen anlegen" },
  { key: "roles.update", label: "Rollen bearbeiten" },
  { key: "roles.delete", label: "Rollen löschen" },
  { key: "settings.general", label: "Einstellungen ändern" },
  { key: "categories.read", label: "Kategorien lesen" },
  { key: "categories.write", label: "Kategorien bearbeiten" },
  { key: "categories.delete", label: "Kategorien löschen" },
];

const EMAIL_PLACEHOLDERS = [
  "{{recipient_name}}",
  "{{recipient_street}}",
  "{{recipient_zip}}",
  "{{recipient_city}}",
  "{{invoice_number}}",
  "{{invoice_date}}",
  "{{due_date}}",
  "{{amount}}",
  "{{bank_name}}",
  "{{iban}}",
  "{{bic}}",
  "{{company_name}}",
  "{{category_name}}",
];

function extractBuildNumber(info: VersionInfo | null) {
  const raw = info?.build?.number;
  if (raw === undefined || raw === null) return null;
  const parsed = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatVersionBadge(info: VersionInfo | null) {
  if (!info) return null;
  const buildNumber = extractBuildNumber(info);
  const numberLabel = buildNumber && buildNumber > 0 ? `v${buildNumber}` : `v${info.version}`;
  const shaPart = info.build?.sha && info.build.sha !== "unknown" ? info.build.sha : null;
  return shaPart ? `${numberLabel} (${shaPart})` : numberLabel;
}

function formatVersionDetail(info: VersionInfo | null) {
  if (!info) return null;
  const parts: string[] = [];
  const buildNumber = extractBuildNumber(info);
  if (buildNumber && buildNumber > 0) parts.push(`build ${buildNumber}`);
  if (info.build?.sha) parts.push(`sha ${info.build.sha}`);
  if (info.build?.time && info.build.time !== "unknown") parts.push(info.build.time);
  const suffix = parts.length ? ` (${parts.join(", ")})` : "";
  return `Version ${info.version}${suffix}`;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: any) {
    console.error("UI ErrorBoundary caught", err);
  }
  render() {
    if (this.state.hasError) {
      const debugInfo =
        import.meta.env.DEV && typeof window !== "undefined"
          ? (window as any).__LAST_API_ERROR__ || null
          : null;
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
          <div className="bg-white border border-red-200 text-red-700 rounded-lg shadow p-6 max-w-lg text-center">
            <h1 className="text-xl font-semibold mb-2">Es ist ein Fehler aufgetreten.</h1>
            <p className="text-sm">Bitte laden Sie die Seite neu. Sollte der Fehler bleiben, wenden Sie sich an den Admin.</p>
            {debugInfo && (
              <p className="text-[11px] text-slate-500 mt-3 break-all">
                Debug: {typeof debugInfo === "string" ? debugInfo : JSON.stringify(debugInfo)}
              </p>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedLayout />}>
              <Route element={<Shell />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/invoices" element={<Invoices />} />
                <Route path="/invoices/new" element={<InvoiceCreatePage />} />
                <Route path="/stats" element={<StatsPage />} />
                <Route path="/categories" element={<Categories />} />
                <Route path="/settings" element={<AdminSettings />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/roles" element={<AdminRoles />} />
                <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

function LoginPage() {
  const { user, login, error, setError } = useAuth();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const reason = params.get("reason");
    if (reason === "idle") {
      setError("Wegen Inaktivität abgemeldet.");
    }
  }, [location.search, setError]);

  useEffect(() => {
    if (user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(username, password, otp.trim() ? otp.trim() : undefined);
      const params = new URLSearchParams(location.search);
      const returnTo = params.get("returnTo");
      const dest = returnTo || (location.state as any)?.from || "/dashboard";
      navigate(dest, { replace: true });
      setOtp("");
      setMfaRequired(false);
    } catch (err: any) {
      const apiErr = err as ApiError;
      const mfaFlag = (apiErr as any)?.data?.mfa_required;
      if (mfaFlag) {
        setMfaRequired(true);
        setError(apiErr.message || "MFA Code erforderlich.");
      } else if (apiErr.status === 429) {
        setError("Zu viele Login-Versuche. Bitte kurz warten und erneut versuchen.");
        setMfaRequired(false);
        setOtp("");
      } else if (apiErr.status === 401) {
        setError("Login fehlgeschlagen. Bitte Zugangsdaten prüfen.");
        setMfaRequired(false);
        setOtp("");
      } else {
        setError(apiErr.message || "Login fehlgeschlagen.");
        setMfaRequired(false);
        setOtp("");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold mb-6 text-slate-900">RechnungsAPP – Login</h1>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Benutzername</label>
            <input
              className="w-full rounded-md border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Passwort</label>
            <input
              type="password"
              className="w-full rounded-md border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">MFA Code (optional)</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              name="one-time-code"
              id="one-time-code"
              className={`w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                mfaRequired ? "border-amber-300 bg-amber-50" : "border-slate-200"
              }`}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              autoComplete="one-time-code"
              autoCorrect="off"
              spellCheck={false}
            />
            <p className="mt-1 text-xs text-slate-500">Nur erforderlich, wenn MFA für dein Konto aktiviert ist.</p>
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 text-white py-2 font-semibold hover:bg-blue-700 transition disabled:opacity-70"
            disabled={submitting}
          >
            {submitting ? "Anmelden ..." : "Einloggen"}
          </button>
        </form>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}

function IdleWatcher() {
  const { user, logout, setError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastResetRef = useRef<number>(0);
  const IDLE_MS = 5 * 60 * 1000;
  const THROTTLE_MS = 1000;

  useEffect(() => {
    const resetTimer = () => {
      const now = Date.now();
      if (now - lastResetRef.current < THROTTLE_MS) return;
      lastResetRef.current = now;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (!user || location.pathname === "/login") return;
      timerRef.current = setTimeout(async () => {
        setError("Wegen Inaktivität abgemeldet.");
        try {
          await logout();
        } catch {
          // ignore
        } finally {
          const returnTo = encodeURIComponent(location.pathname);
          navigate(`/login?reason=idle&returnTo=${returnTo}`, { replace: true });
        }
      }, IDLE_MS);
    };

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "visibilitychange"];
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [IDLE_MS, THROTTLE_MS, location.pathname, logout, navigate, setError, user]);

  return null;
}

function AuthWatcher() {
  const { setError, logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handler = async () => {
      if (!user) return;
      try {
        await logout();
      } catch {
        // ignore
      }
      setError("Session abgelaufen. Bitte erneut anmelden.");
      const returnTo = encodeURIComponent(`${location.pathname}${location.search}${location.hash}`);
      navigate(`/login?reason=expired&returnTo=${returnTo}`, { replace: true });
    };
    window.addEventListener("auth-unauthorized", handler);
    return () => window.removeEventListener("auth-unauthorized", handler);
  }, [logout, navigate, location.pathname, location.search, location.hash, setError, user]);

  return null;
}

function ProtectedLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const fullPath = `${location.pathname}${location.search}${location.hash}`;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-700">Lade Session ...</div>
      </div>
    );
  }

  if (!user && location.pathname !== "/login") {
    const params = new URLSearchParams();
    params.set("returnTo", fullPath);
    params.set("reason", "expired");
    return <Navigate to={`/login?${params.toString()}`} replace />;
  }

  return (
    <>
      <IdleWatcher />
      <AuthWatcher />
      <Outlet />
    </>
  );
}

function Shell() {
  const { user, logout, idleWarning, resetIdleTimer, idleMsRemaining } = useAuth();
  const isAdmin = user?.role_name === "admin";
  const hasStats = isAdmin || (user?.permissions || []).includes("stats.view");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const safeInsets = {
    paddingTop: "env(safe-area-inset-top)",
    paddingBottom: "env(safe-area-inset-bottom)",
  };

  useEffect(() => {
    const stored = localStorage.getItem("ui.sidebarCollapsed");
    if (stored === "1" || stored === "true") setSidebarCollapsed(true);
  }, []);

  useEffect(() => {
    localStorage.setItem("ui.sidebarCollapsed", sidebarCollapsed ? "1" : "0");
  }, [sidebarCollapsed]);

  useEffect(() => {
    getVersion()
      .then(setVersionInfo)
      .catch(() => setVersionInfo(null));
  }, []);

  const versionBadgeLabel = useMemo(() => formatVersionBadge(versionInfo), [versionInfo]);
  const apiDebugLabel = useMemo(() => {
    if (!import.meta.env.DEV) return null;
    const buildNumber = extractBuildNumber(versionInfo);
    const sha = versionInfo?.build?.sha || "";
    const buildPart = buildNumber && buildNumber > 0 ? `#${buildNumber}` : versionInfo?.version || "";
    const shaPart = sha && sha !== "unknown" ? ` (${sha})` : "";
    return `API ${API_BASE} · build ${buildPart}${shaPart}`;
  }, [versionInfo]);

  const links = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/customers", label: "Kunden" },
    { to: "/invoices", label: "Rechnungen" },
    ...(hasStats ? [{ to: "/stats", label: "Statistiken" }] : []),
    ...(isAdmin
      ? [
          { to: "/categories", label: "Kategorien" },
          { to: "/settings", label: "Einstellungen" },
          { to: "/admin/users", label: "Admin: Benutzer" },
          { to: "/admin/roles", label: "Admin: Rollen & Rechte" },
        ]
      : []),
  ];

  return (
    <div className="bg-slate-50 text-slate-900 h-[100dvh] min-h-[100dvh]" style={safeInsets}>
      <div className="flex h-full w-full overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`bg-white border-r border-slate-200 shadow-sm h-full flex flex-col transition-[width] duration-200 ease-in-out ${
            sidebarCollapsed ? "w-16" : "w-64"
          } hidden md:flex`}
        >
          <div className="h-14 flex items-center justify-between px-3 border-b border-slate-200">
            <div className="text-sm font-semibold text-slate-800">{sidebarCollapsed ? "RE" : "RechnungsAPP"}</div>
            <button
              className="text-slate-500 hover:text-slate-700 rounded-md p-1"
              onClick={() => setSidebarCollapsed((s) => !s)}
              aria-label="Sidebar umschalten"
            >
              {sidebarCollapsed ? "›" : "‹"}
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1" style={{ WebkitOverflowScrolling: "touch" }}>
            {links.map((l) => (
              <SidebarLink
                key={l.to}
                to={l.to}
                label={l.label}
                collapsed={sidebarCollapsed}
                onClick={() => setSidebarOpen(false)}
              />
            ))}
          </nav>
        </aside>

        {/* Mobile Drawer */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/30 md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Sidebar schließen"
          />
        )}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 shadow-lg p-3 transition-transform duration-200 md:hidden ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="h-12 flex items-center justify-between mb-2">
            <div className="font-semibold">RechnungsAPP</div>
            <button className="text-slate-500 hover:text-slate-700" onClick={() => setSidebarOpen(false)}>✕</button>
          </div>
          <nav className="flex flex-col gap-1">
            {links.map((l) => (
              <SidebarLink key={l.to} to={l.to} label={l.label} onClick={() => setSidebarOpen(false)} />
            ))}
          </nav>
        </aside>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0 h-full">
          <header className="h-14 flex items-center justify-between px-4 md:px-6 bg-white border-b border-slate-200 shadow-sm flex-none">
            <div className="flex items-center gap-3">
              <button
                className="md:hidden rounded-md border border-slate-200 px-2 py-1"
                onClick={() => setSidebarOpen((s) => !s)}
                aria-label="Menü öffnen"
              >
                ☰
              </button>
              <div className="font-semibold text-slate-800">RechnungsAPP</div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              {apiDebugLabel && (
                <span className="text-[11px] text-slate-600 bg-slate-100 border border-slate-200 rounded px-2 py-1 hidden sm:inline">
                  {apiDebugLabel}
                </span>
              )}
              {versionBadgeLabel && (
                <span
                  className="text-xs text-slate-600 bg-slate-100 border border-slate-200 rounded px-2 py-1 whitespace-nowrap hidden sm:inline"
                  title={versionInfo?.build?.time || `Version ${versionInfo?.version || ""}`}
                >
                  {versionBadgeLabel}
                </span>
              )}
              <span className="text-slate-600 hidden sm:inline">
                {user?.username} {isAdmin ? "(Admin)" : ""}
              </span>
              <span className="text-xs text-slate-500 whitespace-nowrap">
                Auto-Logout: {Math.max(0, Math.floor(idleMsRemaining / 1000 / 60)).toString().padStart(1, "0")}:
                {Math.max(0, Math.floor((idleMsRemaining / 1000) % 60)).toString().padStart(2, "0")}
              </span>
              <Button variant="secondary" onClick={logout}>
                Logout
              </Button>
            </div>
          </header>
          <main
            className="flex-1 min-w-0 overflow-y-auto bg-slate-50"
            style={{ overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}
          >
            <div className="px-4 md:px-6 py-4 md:py-6 max-w-6xl mx-auto">
              {idleWarning && (
                <Alert type="info">
                  <div className="flex flex-wrap items-center gap-3">
                    <span>
                      Du wirst in Kürze automatisch abgemeldet. Verbleibend:{" "}
                      {Math.max(0, Math.floor(idleMsRemaining / 1000))}s
                    </span>
                    <Button variant="secondary" onClick={resetIdleTimer}>
                      Angemeldet bleiben
                    </Button>
                  </div>
                </Alert>
              )}
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role_name === "admin";
  const hasStats = isAdmin || (user?.permissions || []).includes("stats.view");

  const cards = useMemo(
    () => ["Rechnungen", "Kunden", ...(hasStats ? ["Statistiken"] : []), "Einstellungen"],
    [hasStats],
  );

  const [recent, setRecent] = useState<RecentInvoice[]>([]);
  const [recentStatus, setRecentStatus] = useState<FormStatus>(null);
  const [recentLoading, setRecentLoading] = useState(true);
  const [preview, setPreview] = useState<{ open: boolean; html: string; text: string; subject: string } | null>(null);

  useEffect(() => {
    setRecentStatus(null);
    setRecentLoading(true);
    listRecentInvoices(10)
      .then(setRecent)
      .catch((err: ApiError) => setRecentStatus({ type: "error", message: err.message || "Rechnungen konnten nicht geladen werden." }))
      .finally(() => setRecentLoading(false));
  }, []);

  const statusLabel = (inv: RecentInvoice) => {
    if (inv.status_paid_at) return { text: "bezahlt", tone: "green" as const };
    if (inv.status_sent) return { text: "gesendet", tone: "blue" as const };
    return { text: "offen", tone: "amber" as const };
  };

  const openInvoice = (id: number) => navigate(`/invoices/${id}`);
  const formatAmount = (value: any) => {
    const num = Number(value);
    return Number.isFinite(num)
      ? `${num.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
      : "–";
  };

  const openPdf = (id: number) => {
    window.open(`/api/invoices/${id}/pdf?mode=inline`, "_blank");
  };

  const regeneratePdf = async (id: number) => {
    try {
      await regenerateInvoicePdf(id);
      openPdf(id);
    } catch (err: any) {
      alert((err as ApiError)?.message || "PDF konnte nicht neu erstellt werden.");
    }
  };

  const previewEmail = async (id: number) => {
    try {
      const data = await getInvoiceEmailPreview(id);
      setPreview({ open: true, html: data.body_html || "", text: data.body_text || "", subject: data.subject });
    } catch (err: any) {
      const apiErr = err as ApiError;
      alert(apiErr.message || "E-Mail-Vorschau konnte nicht geladen werden.");
    }
  };

  const actionMenu = (inv: RecentInvoice) => (
    <MoreMenu
      items={[
        { label: "Öffnen", onClick: () => openInvoice(inv.id) },
        { label: "PDF öffnen", onClick: () => openPdf(inv.id) },
        { label: "E-Mail Vorschau", onClick: () => previewEmail(inv.id) },
        ...(user?.role_name === "admin"
          ? [
              {
                label: "PDF neu erstellen",
                onClick: () => regeneratePdf(inv.id),
              },
            ]
          : []),
      ]}
    />
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
        <p className="text-slate-700">
          Schnelle Navigation zu den wichtigsten Bereichen.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((title) => (
          <Link
            key={title}
            to={
              title === "Rechnungen"
                ? "/invoices"
                : title === "Kunden"
                ? "/customers"
                : title === "Statistiken"
                ? "/stats"
                : "/settings"
            }
            className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:border-blue-300 transition"
          >
            <div className="font-semibold mb-1">{title}</div>
            <div className="text-sm text-slate-600">Öffnen</div>
          </Link>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold">Letzte Rechnungen</h2>
            <p className="text-sm text-slate-600">Die 10 aktuellsten Rechnungen mit Status.</p>
          </div>
          {recentLoading && <span className="text-xs text-slate-500">Lade ...</span>}
        </div>
          {recentStatus && <Alert type={recentStatus.type === "error" ? "error" : "success"}>{recentStatus.message}</Alert>}
        {!recentLoading && !recent.length && !recentStatus && (
          <EmptyState title="Noch keine Rechnungen" description="Lege eine neue Rechnung an, um zu starten." />
        )}
        {!recentLoading && recent.length > 0 && (
          <div className="relative border border-slate-200 rounded-lg">
            <div className="sticky top-0 bg-slate-50 border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 flex items-center">
              <div className="flex-1">Rechnung</div>
              <div className="w-20 text-right">Betrag</div>
              <div className="w-10 text-right">…</div>
            </div>
            <div className="overflow-x-auto overflow-y-visible">
              <table className="w-full text-sm">
                <tbody>
                  {recent.map((inv) => {
                    const st = statusLabel(inv);
                    return (
                      <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900 truncate">{inv.invoice_number}</span>
                              <Badge tone={st.tone}>{st.text}</Badge>
                            </div>
                            <div className="text-slate-700 truncate">{inv.recipient_name || "–"}</div>
                            <div className="text-xs text-slate-500 flex flex-wrap gap-2">
                              <span>{inv.date ? new Date(inv.date).toLocaleDateString() : "–"}</span>
                              <span>•</span>
                              <span>{inv.category_label || "Kategorie –"}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 w-24 text-right align-top text-slate-900">
                          {formatAmount(inv.gross_total)}
                        </td>
                        <td className="px-3 py-3 w-10 text-right align-top">{actionMenu(inv)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {preview?.open && (
        <Modal title={preview.subject || "E-Mail Vorschau"} onClose={() => setPreview(null)}>
          <div className="space-y-3">
            <div>
              <div className="font-semibold">Betreff</div>
              <div className="text-sm">{preview.subject}</div>
            </div>
            <div>
              <div className="font-semibold">HTML</div>
              <div
                className="border border-slate-200 rounded p-3 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: preview.html || "<em>(leer)</em>" }}
              />
            </div>
            <div>
              <div className="font-semibold">Text</div>
              <pre className="border border-slate-200 rounded p-3 whitespace-pre-wrap text-sm bg-white">
                {preview.text || "(leer)"}
              </pre>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PlaceholderCard({ title }: { title: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
      <h2 className="font-semibold mb-2">{title}</h2>
      <p className="text-sm text-slate-600">Öffnen oder Aktion ausführen.</p>
    </div>
  );
}

function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filtered, setFiltered] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: "create" | "edit"; customer?: Customer } | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);
  const [toast, setToast] = useState<FormStatus>(null);

  const applyFilter = useCallback((list: Customer[], term: string) => {
    const t = term.toLowerCase();
    if (!t) return list;
    return list.filter((c) =>
      [c.name, c.email, c.city, c.zip].some((v) => (v || "").toLowerCase().includes(t))
    );
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listCustomers();
      setCustomers(res);
    } catch (err: any) {
      const apiErr = err as ApiError;
      setError(apiErr.message || "Kunden konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setFiltered(applyFilter(customers, search));
  }, [applyFilter, customers, search]);

  const onDelete = async (id: number) => {
    setBusyDelete(true);
    setToast(null);
    try {
      await deleteCustomer(id);
      setCustomers((prev) => prev.filter((c) => c.id !== id));
      setToast({ type: "success", message: "Kunde gelöscht." });
    } catch (err: any) {
      const apiErr = err as ApiError;
      const msg =
        apiErr?.message?.includes("existieren noch Rechnungen")
          ? "Löschen nicht möglich: Es existieren noch Rechnungen für diesen Kunden."
          : apiErr.message || "Kunde konnte nicht gelöscht werden.";
      setToast({ type: "error", message: msg });
    } finally {
      setBusyDelete(false);
      setConfirmId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Kunden</h1>
          <p className="text-slate-600 text-sm">Empfänger verwalten (Name erforderlich, sonst optional).</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" disabled={loading} onClick={load}>
            {loading ? "Lädt..." : "Refresh"}
          </Button>
          <Button onClick={() => setModal({ mode: "create" })}>Neu</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <Input
          placeholder="Suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-600">
          <Spinner /> Lade Kunden ...
        </div>
      )}

      {error && <Alert type="error">{error}</Alert>}

      {!loading && !filtered.length && !error && (
        <EmptyState title="Keine Kunden gefunden" description="Lege einen neuen Kunden an, um zu starten." />
      )}

      {!loading && filtered.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-visible">
          <div className="sticky top-0 bg-slate-50 border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 flex items-center">
            <div className="flex-1">Kunde</div>
            <div className="w-12 text-right">…</div>
          </div>
          <div className="flex-1">
            <table className="w-full text-sm">
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 align-top">
                    <td className="px-3 py-3">
                      <div className="font-semibold text-slate-900 truncate">{c.name}</div>
                      <div className="text-sm text-slate-700 truncate">{c.email || "–"}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {[c.street, [c.zip, c.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "–"}
                      </div>
                      {c.phone && <div className="text-xs text-slate-500 mt-0.5">{c.phone}</div>}
                    </td>
                    <td className="px-3 py-3 w-12 text-right align-top">
                      <MoreMenu
                        items={[
                          { label: "Bearbeiten", onClick: () => setModal({ mode: "edit", customer: c }) },
                          { label: "Löschen", danger: true, onClick: () => setConfirmId(c.id) },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {toast && <Alert type={toast.type === "success" ? "success" : "error"}>{toast.message}</Alert>}

      {modal && (
        <CustomerFormModal
          mode={modal.mode}
          customer={modal.customer}
          onClose={() => setModal(null)}
          onSaved={(saved) => {
            setModal(null);
            if (modal.mode === "edit" && saved) {
              setCustomers((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
            } else if (saved) {
              setCustomers((prev) => [...prev, saved]);
            }
            setToast({ type: "success", message: "Kunde gespeichert." });
          }}
          onError={(msg) => setToast({ type: "error", message: msg })}
        />
      )}

      {confirmId !== null && (
        <Confirm
          title="Kunde löschen?"
          description="Wenn zu diesem Kunden Rechnungen existieren, kann er nicht gelöscht werden."
          onConfirm={() => onDelete(confirmId)}
          onCancel={() => setConfirmId(null)}
          busy={busyDelete}
        />
      )}
    </div>
  );
}

function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [logos, setLogos] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<FormStatus>(null);
  const [modal, setModal] = useState<{ mode: "create" | "edit"; category?: Category } | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);

  const applyFilter = (list: Category[], term: string) => {
    const t = term.toLowerCase();
    if (!t) return list;
    return list.filter((c) => (c.label || "").toLowerCase().includes(t) || (c.key || "").toLowerCase().includes(t));
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [cats, logoList] = await Promise.all([listCategories(), listCategoryLogos().catch(() => [])]);
      setCategories(cats);
      setLogos(logoList);
    } catch (err: any) {
      const apiErr = err as ApiError;
      setError(apiErr.message || "Kategorien konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = applyFilter(categories, search);

  const onDelete = async (id: number) => {
    setBusyDelete(true);
    setToast(null);
    try {
      await apiDeleteCategory(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      setToast({ type: "success", message: "Kategorie gelöscht." });
    } catch (err: any) {
      const apiErr = err as ApiError;
      setToast({ type: "error", message: apiErr.message || "Kategorie konnte nicht gelöscht werden." });
    } finally {
      setBusyDelete(false);
      setConfirmId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Kategorien</h1>
          <p className="text-slate-600 text-sm">Logos, Templates und SMTP pro Kategorie verwalten.</p>
        </div>
        <Button onClick={() => setModal({ mode: "create" })}>Neu</Button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <Input
          placeholder="Suche nach Label/Key"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <MoreMenu
          items={[
            { label: "Aktualisieren", onClick: load },
          ]}
        />
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-600">
          <Spinner /> Lade Kategorien ...
        </div>
      )}
      {error && <Alert type="error">{error}</Alert>}
      {!loading && !filtered.length && !error && (
        <EmptyState title="Keine Kategorien" description="Lege eine neue Kategorie mit Logo an." />
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((cat) => (
            <div key={cat.id} className="border border-slate-200 rounded-lg p-4 bg-white shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {cat.logo_file ? (
                    <img
                      src={`/logos/${cat.logo_file}`}
                      alt="Logo"
                      className="w-12 h-12 object-contain border border-slate-200 rounded"
                    />
                  ) : (
                    <div className="w-12 h-12 border border-dashed border-slate-200 rounded flex items-center justify-center text-xs text-slate-500">
                      Logo
                    </div>
                  )}
                  <div>
                    <div className="font-semibold">{cat.label}</div>
                    <div className="text-xs text-slate-500">{cat.key}</div>
                  </div>
                </div>
                <MoreMenu
                  items={[
                    { label: "Bearbeiten", onClick: () => setModal({ mode: "edit", category: cat }) },
                    { label: "Löschen", danger: true, onClick: () => setConfirmId(cat.id) },
                  ]}
                />
              </div>
              {cat.template && (
                <div className="mt-3 text-xs text-slate-600">
                  <div className="font-semibold">Template:</div>
                  <div>{cat.template.subject}</div>
                </div>
              )}
              {cat.email_account && (
                <div className="mt-2 text-xs text-slate-600">
                  <div className="font-semibold">SMTP:</div>
                  <div>{cat.email_account.email_address}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {toast && <Alert type={toast.type === "success" ? "success" : "error"}>{toast.message}</Alert>}

      {modal && (
        <CategoryFormModal
          mode={modal.mode}
          category={modal.category}
          logos={logos}
          onClose={() => setModal(null)}
          onSaved={(cat) => {
            setModal(null);
            if (modal.mode === "edit") {
              setCategories((prev) => prev.map((c) => (c.id === cat.id ? cat : c)));
            } else {
              setCategories((prev) => [...prev, cat]);
            }
            setToast({ type: "success", message: "Kategorie gespeichert." });
          }}
          onError={(msg) => setToast({ type: "error", message: msg })}
        />
      )}

      {confirmId !== null && (
        <Confirm
          title="Kategorie löschen?"
          description="Kategorie wird entfernt. Stelle sicher, dass keine Rechnungen sie benötigen."
          onConfirm={() => onDelete(confirmId)}
          onCancel={() => setConfirmId(null)}
          busy={busyDelete}
        />
      )}
    </div>
  );
}

function Invoices() {
  type InvoiceStatusFilter = "active" | "all" | "open" | "sent" | "paid" | "canceled";
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get("status") as InvoiceStatusFilter | null;
  const allowedStatuses: InvoiceStatusFilter[] = ["active", "all", "open", "sent", "paid", "canceled"];
  const initialStatus: InvoiceStatusFilter = statusParam && allowedStatuses.includes(statusParam) ? statusParam : "active";
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [filtered, setFiltered] = useState<InvoiceListItem[]>([]);
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [invoiceNumberFilter, setInvoiceNumberFilter] = useState(searchParams.get("inv") || "");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(
    (searchParams.get("order") as "asc" | "desc") || "desc"
  );
  const [statusFilter, setStatusFilter] = useState<InvoiceStatusFilter>(initialStatus);
  const [categoryFilter, setCategoryFilter] = useState<string>(searchParams.get("category") || "all");
  const [fromDate, setFromDate] = useState<string>(searchParams.get("from") || "");
  const [toDate, setToDate] = useState<string>(searchParams.get("to") || "");
  const [customerFilter, setCustomerFilter] = useState<string>(searchParams.get("customer") || "");
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: "edit"; id?: number } | null>(null);
  const [toast, setToast] = useState<FormStatus>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ loading: boolean; data: any | null; error: string | null }>({ loading: false, data: null, error: null });
  const [sendModal, setSendModal] = useState<{ open: boolean; id?: number; to?: string; subject?: string; message?: string; includeDatev?: boolean }>({ open: false });
  const [pdfBusyId, setPdfBusyId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; reason: string }>({ open: false, reason: "" });
  const [bulkBusy, setBulkBusy] = useState(false);
  const [createProgress, setCreateProgress] = useState<{
    open: boolean;
    status: "idle" | "submitting" | "success" | "error";
    invoiceId?: number | null;
    invoiceNumber?: string;
    error?: string | null;
  }>({ open: false, status: "idle" });

  const computeStatus = useCallback((inv: InvoiceListItem): "open" | "sent" | "paid" | "canceled" => {
    if (inv.canceled_at) return "canceled";
    if (inv.status_paid_at) return "paid";
    if (inv.status_sent) return "sent";
    return "open";
  }, []);

  const datevLabel = (inv: InvoiceListItem) => {
    const status = inv.datev_export_status;
    if (status === "SUCCESS" || status === "SENT") {
      return { text: inv.datev_exported_at ? `✅ ${new Date(inv.datev_exported_at).toLocaleDateString()}` : "✅" };
    }
    if (status === "FAILED") return { text: "❌", error: inv.datev_export_error };
    if (status === "SKIPPED") return { text: "⏭️", error: inv.datev_export_error };
    return { text: "—" };
  };

  const statusLabel = (s: InvoiceStatusFilter) => {
    const labels: Record<InvoiceStatusFilter, string> = {
      active: "Aktiv (ohne Storno)",
      all: "Alle inkl. Storno",
      open: "Offen",
      sent: "Gesendet",
      paid: "Bezahlt",
      canceled: "Storniert",
    };
    return labels[s];
  };

  const applyFilter = useCallback(
    (
      list: InvoiceListItem[],
      term: string,
      status: InvoiceStatusFilter,
      categoryKey: string,
      customerTerm: string,
      invoiceNoTerm: string,
      order: "asc" | "desc"
    ) => {
    const t = term.toLowerCase();
    const ct = customerTerm.toLowerCase();
    const it = invoiceNoTerm.toLowerCase();
    return list
      .filter((inv) => {
        const matchesInvoiceNumber = !it || inv.invoice_number.toLowerCase().includes(it);
        const matchesTerm =
          !t ||
          inv.invoice_number.toLowerCase().includes(t) ||
          (inv.recipient_name || "").toLowerCase().includes(t);
        const matchesCustomer = !ct || (inv.recipient_name || "").toLowerCase().includes(ct);
        const st = computeStatus(inv);
        const matchesStatus =
          status === "all"
            ? true
            : status === "active"
            ? st !== "canceled"
            : st === status;
        const matchesCategory = categoryKey === "all" || inv.category_label === categoryKey;
        return matchesTerm && matchesCustomer && matchesStatus && matchesCategory && matchesInvoiceNumber;
      })
      .sort((a, b) => {
        const aDate = a.date ? new Date(a.date).getTime() : 0;
        const bDate = b.date ? new Date(b.date).getTime() : 0;
        if (aDate === bDate) {
          const aNum = a.invoice_number.toLowerCase();
          const bNum = b.invoice_number.toLowerCase();
          return order === "asc" ? aNum.localeCompare(bNum) : bNum.localeCompare(aNum);
        }
        return order === "asc" ? aDate - bDate : bDate - aDate;
      });
    },
    [computeStatus]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, cats] = await Promise.all([
        listInvoices({
          from: fromDate || undefined,
          to: toDate || undefined,
          customer: customerFilter || undefined,
          status: [statusFilter],
          category: categoryFilter === "all" ? undefined : categoryFilter,
        }),
        listCategories().catch(() => []),
      ]);
      setInvoices(res);
      setCategories(cats);
      setSelectedIds((prev) => prev.filter((id) => res.some((inv) => inv.id === id)));
    } catch (err: any) {
      const apiErr = err as ApiError;
      setError(apiErr.message || "Rechnungen konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, customerFilter, fromDate, statusFilter, toDate]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setFiltered(
      applyFilter(invoices, search, statusFilter, categoryFilter, customerFilter, invoiceNumberFilter, sortOrder)
    );
  }, [applyFilter, categoryFilter, customerFilter, invoiceNumberFilter, invoices, search, sortOrder, statusFilter]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => filtered.some((inv) => inv.id === id)));
  }, [filtered]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (statusFilter !== "active") params.set("status", statusFilter);
    if (categoryFilter !== "all") params.set("category", categoryFilter);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    if (customerFilter.trim()) params.set("customer", customerFilter.trim());
    if (invoiceNumberFilter.trim()) params.set("inv", invoiceNumberFilter.trim());
    if (sortOrder !== "desc") params.set("order", sortOrder);
    setSearchParams(params, { replace: true });
  }, [search, statusFilter, categoryFilter, fromDate, toDate, customerFilter, invoiceNumberFilter, sortOrder, setSearchParams]);

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("active");
    setCategoryFilter("all");
    setFromDate("");
    setToDate("");
    setCustomerFilter("");
    setInvoiceNumberFilter("");
    setSortOrder("desc");
  };

  const activeFilters = [
    search ? "Suche" : null,
    invoiceNumberFilter ? `Rechnungsnr.: ${invoiceNumberFilter}` : null,
    statusFilter !== "active" ? `Status: ${statusLabel(statusFilter)}` : null,
    categoryFilter !== "all" ? `Kategorie: ${categoryFilter}` : null,
    fromDate ? `Von ${fromDate}` : null,
    toDate ? `Bis ${toDate}` : null,
    customerFilter ? `Kunde: ${customerFilter}` : null,
    sortOrder === "asc" ? "Sortierung: Alt → Neu" : null,
  ].filter(Boolean);

  const selectedCount = selectedIds.length;
  const allVisibleSelected = filtered.length > 0 && filtered.every((inv) => selectedIds.includes(inv.id));

  const toggleSelect = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) {
        if (prev.includes(id)) return prev;
        return [...prev, id];
      }
      return prev.filter((item) => item !== id);
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filtered.map((inv) => inv.id));
    } else {
      setSelectedIds([]);
    }
  };

  const startBulkCancel = () => {
    if (!selectedCount) return;
    setCancelDialog({ open: true, reason: "" });
  };

  const submitBulkCancel = async () => {
    if (!selectedCount) return;
    setBulkBusy(true);
    setToast(null);
    try {
      const res = await bulkCancelInvoices(selectedIds, cancelDialog.reason.trim() || undefined);
      setToast({ type: "success", message: `${res.updated} Rechnung(en) storniert.` });
      setCancelDialog({ open: false, reason: "" });
      setSelectedIds([]);
      await load();
    } catch (err: any) {
      const apiErr = err as ApiError;
      const msg = apiErr.message || "Storno fehlgeschlagen.";
      setToast({ type: "error", message: msg });
    } finally {
      setBulkBusy(false);
    }
  };

  const loadPreview = async (id: number) => {
    setPreview({ loading: true, data: null, error: null });
    try {
      const data = await getInvoiceEmailPreview(id);
      setPreview({ loading: false, data, error: null });
    } catch (err: any) {
      const apiErr = err as ApiError;
      let msg = apiErr.message || "Vorschau konnte nicht geladen werden.";
      if (apiErr.status === 401 || apiErr.status === 403) msg = "Keine Berechtigung.";
      setPreview({ loading: false, data: null, error: msg });
    }
  };

  const openSend = (id: number, toDefault?: string) => {
    setSendModal({ open: true, id, to: toDefault || "" });
  };

  const onRegenerate = async (id: number) => {
    setBusyId(id);
    setToast(null);
    try {
      const res = await regenerateInvoicePdf(id);
      setToast({
        type: "success",
        message: `PDF neu erstellt (${res.filename})${res.size ? `, ${res.size} Bytes` : ""}.`,
      });
      window.open(`/api/invoices/${id}/pdf?mode=inline`, "_blank");
    } catch (err: any) {
      const apiErr = err as ApiError;
      setToast({ type: "error", message: apiErr.message || "PDF konnte nicht neu erstellt werden." });
    } finally {
      setBusyId(null);
    }
  };

  const onDeleted = (id: number) => {
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));
    setToast({ type: "success", message: "Rechnung gelöscht." });
  };

  const onSendEmail = async () => {
    if (!sendModal.id) return;
    if (!sendModal.to || !sendModal.to.trim()) {
      setToast({ type: "error", message: "Bitte Empfänger-E-Mail angeben." });
      return;
    }
    setBusyId(sendModal.id);
    setToast(null);
    try {
      const res = await sendInvoiceEmailApi(sendModal.id, {
        to: sendModal.to.trim(),
        subject: sendModal.subject || undefined,
        message: sendModal.message || undefined,
        include_datev: sendModal.includeDatev,
      });
      setToast({ type: "success", message: res.message || "E-Mail gesendet." });
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === sendModal.id
            ? {
                ...inv,
                status_sent: true,
                status_sent_at: new Date().toISOString(),
                ...(sendModal.includeDatev
                  ? { datev_export_status: "SENT", datev_exported_at: new Date().toISOString(), datev_export_error: null }
                  : {}),
              }
            : inv
        )
      );
      setSendModal({ open: false });
    } catch (err: any) {
      const apiErr = err as ApiError;
      let msg = apiErr.message || "E-Mail konnte nicht gesendet werden.";
      if (apiErr.status === 401 || apiErr.status === 403) msg = "Keine Berechtigung.";
      if (apiErr.status === 400 && msg.toLowerCase().includes("smtp")) {
        msg = "E-Mail Versand ist nicht konfiguriert (SMTP). Bitte Einstellungen prüfen.";
      }
      setToast({ type: "error", message: msg });
    } finally {
      setBusyId(null);
    }
  };

  const onDatevExport = async (id: number) => {
    setBusyId(id);
    setToast(null);
    try {
      const res = await exportInvoiceDatev(id);
      setToast({ type: "success", message: res.message || "DATEV Export gestartet." });
    } catch (err: any) {
      const apiErr = err as ApiError;
      const msg = apiErr.message || "DATEV Export fehlgeschlagen.";
      setToast({ type: "error", message: msg });
    } finally {
      setBusyId(null);
    }
  };

  const handlePdfOpen = async (id: number, force = false) => {
    const url = `/api/invoices/${id}/pdf?mode=inline${force ? "&force=1" : ""}`;
    setPdfBusyId(id);
    try {
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 423) {
        const data = await res.json().catch(() => ({}));
        alert(data?.message || "PDF ist gesperrt (DATEV).");
        return;
      }
      if (res.status === 410) {
        const data = await res.json().catch(() => ({}));
        const wants = window.confirm(data?.message || "PDF ist beschädigt. Neu erstellen?");
        if (wants) {
          try {
            await regenerateInvoicePdf(id);
            return handlePdfOpen(id, false);
          } catch (err: any) {
            const apiErr = err as ApiError;
            alert(apiErr.message || "PDF konnte nicht neu erstellt werden.");
          }
        }
        return;
      }
      if (!res.ok) {
        alert(`PDF konnte nicht geladen werden (Status ${res.status}).`);
        return;
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
    } finally {
      setPdfBusyId(null);
    }
  };

  const onDelete = async (id: number) => {
    setBusyId(id);
    setToast(null);
    try {
      await deleteInvoice(id);
      setInvoices((prev) => prev.filter((inv) => inv.id !== id));
      setSelectedIds((prev) => prev.filter((sid) => sid !== id));
      setToast({ type: "success", message: "Rechnung gelöscht." });
    } catch (err: any) {
      const apiErr = err as ApiError;
      const msg = apiErr.message || "Rechnung konnte nicht gelöscht werden.";
      setToast({ type: "error", message: msg });
    } finally {
      setBusyId(null);
    }
  };

  const markAsSent = async (id: number) => {
    setBusyId(id);
    setToast(null);
    try {
      await markInvoiceSent(id);
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === id ? { ...inv, status_sent: true, status_sent_at: new Date().toISOString() } : inv))
      );
      setToast({ type: "success", message: "Als gesendet markiert." });
    } catch (err: any) {
      const apiErr = err as ApiError;
      const msg =
        apiErr.status === 401 || apiErr.status === 403
          ? "Keine Berechtigung."
          : apiErr.status === 429
          ? "Zu viele Versuche. Bitte kurz warten."
          : apiErr.message || "Konnte nicht markieren.";
      setToast({ type: "error", message: msg });
    } finally {
      setBusyId(null);
    }
  };

  const markAsPaid = async (id: number) => {
    setBusyId(id);
    setToast(null);
    try {
      await markInvoicePaid(id);
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === id ? { ...inv, status_paid_at: new Date().toISOString() } : inv))
      );
      setToast({ type: "success", message: "Als bezahlt markiert." });
    } catch (err: any) {
      const apiErr = err as ApiError;
      const msg =
        apiErr.status === 401 || apiErr.status === 403
          ? "Keine Berechtigung."
          : apiErr.status === 429
          ? "Zu viele Versuche. Bitte kurz warten."
          : apiErr.message || "Konnte nicht markieren.";
      setToast({ type: "error", message: msg });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full min-h-[70vh]">
      <div className="sticky top-0 z-10 bg-slate-50/90 backdrop-blur border-b border-slate-200 pb-2 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div>
            <h1 className="text-2xl font-bold">Rechnungen</h1>
            <p className="text-slate-600 text-sm">PDF-Aktionen direkt an der Rechnung.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" disabled={loading} onClick={load}>
              {loading ? "Lädt..." : "Refresh"}
            </Button>
            <Button onClick={() => navigate("/invoices/new")}>Neu</Button>
          </div>
        </div>

      <div className="grid gap-2 text-sm lg:grid-cols-6 md:grid-cols-4 grid-cols-2">
        <Input
          placeholder="Nummer/Empfänger"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 text-sm"
        />
        <Input
          placeholder="Rechnungsnr."
          value={invoiceNumberFilter}
          onChange={(e) => setInvoiceNumberFilter(e.target.value)}
          className="h-9 text-sm"
        />
        <Input
          placeholder="Kunde"
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value)}
          className="h-9 text-sm"
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="h-9 text-sm"
        >
          <option value="active">Aktiv</option>
          <option value="all">Alle</option>
          <option value="open">Offen</option>
          <option value="sent">Gesendet</option>
          <option value="paid">Bezahlt</option>
          <option value="canceled">Storniert</option>
        </Select>
        <Select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-9 text-sm"
        >
          <option value="all">Alle Kategorien</option>
          {categories.map((c) => (
            <option key={c.id} value={c.label}>
              {c.label}
            </option>
          ))}
        </Select>
        <Select
          value={sortOrder}
          onChange={(e) => setSortOrder((e.target.value as "asc" | "desc") || "desc")}
          className="h-9 text-sm"
        >
          <option value="desc">Neu → Alt</option>
          <option value="asc">Alt → Neu</option>
        </Select>
        <Input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="h-9 text-sm"
            placeholder="Von"
          />
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-9 text-sm"
            placeholder="Bis"
          />
          <Button
            variant="ghost"
            onClick={resetFilters}
            disabled={loading}
            className="h-9 text-sm col-span-2 md:col-span-1"
          >
            Filter zurücksetzen
          </Button>
        </div>
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="font-medium text-slate-700">Aktive Filter:</span>
            {activeFilters.map((f, idx) => (
              <span key={idx} className="px-2 py-1 rounded-full bg-slate-100 border border-slate-200">
                {f}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 bg-white/80 border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
          <div className="text-sm font-medium text-slate-700">
            {selectedCount ? `${selectedCount} ausgewählt` : "Keine Auswahl"}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setSelectedIds([])} disabled={!selectedCount || bulkBusy}>
              Auswahl leeren
            </Button>
            <Button variant="danger" onClick={startBulkCancel} disabled={!selectedCount || bulkBusy}>
              {bulkBusy ? "Storniert..." : `Stornieren (${selectedCount})`}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 space-y-3">
        {loading && (
          <div className="flex items-center gap-2 text-slate-600">
            <Spinner /> Lade Rechnungen ...
          </div>
        )}
        {error && <Alert type="error">{error}</Alert>}
        {!loading && !filtered.length && !error && (
          <EmptyState title="Keine Rechnungen" description="Lege eine neue Rechnung an." />
        )}

        {!loading && filtered.length > 0 && (
          <div className="relative overflow-visible bg-white border border-slate-200 rounded-lg shadow-sm">
            <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 flex items-center">
              <div className="w-12 text-center">
                <input
                  type="checkbox"
                  aria-label="Alle auswählen"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={allVisibleSelected}
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                />
              </div>
              <div className="flex-1">Rechnung</div>
              <div className="w-28 text-right">Betrag</div>
              <div className="w-14 text-right">…</div>
            </div>
            <div>
              <table className="w-full text-sm">
                <tbody>
                  {filtered.map((inv) => {
                    const st = computeStatus(inv);
                    const datev = datevLabel(inv);
                    const isSelected = selectedIds.includes(inv.id);
                    const isCanceled = st === "canceled";
                    const cancelReason = (inv.cancel_reason || "").trim();
                    return (
                      <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50 align-top">
                        <td className="px-3 py-3 w-12 text-center align-top">
                          <input
                            type="checkbox"
                            aria-label="Rechnung auswählen"
                            className="h-4 w-4 rounded border-slate-300"
                            checked={isSelected}
                            onChange={(e) => toggleSelect(inv.id, e.target.checked)}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="font-semibold text-slate-900 truncate">{inv.invoice_number}</div>
                                {st === "canceled" ? (
                                  <Badge tone="gray">Storniert</Badge>
                                ) : st === "paid" ? (
                                  <Badge tone="green">Bezahlt</Badge>
                                ) : st === "sent" ? (
                                  <Badge tone="blue">Gesendet</Badge>
                                ) : (
                                  <Badge tone="amber">Offen</Badge>
                                )}
                              </div>
                              <div className="text-slate-700 truncate">{inv.recipient_name || "–"}</div>
                              <div className="text-xs text-slate-500 flex flex-wrap gap-2 mt-1">
                                <span>{inv.date ? new Date(inv.date).toLocaleDateString() : "–"}</span>
                                <span>•</span>
                                <span>{inv.category_label || "Kategorie –"}</span>
                                <span>•</span>
                                <span>DATEV: {datev.text}</span>
                              </div>
                              {datev.error && <div className="text-xs text-amber-700 mt-0.5">{datev.error}</div>}
                              {isCanceled && (
                                <div className="text-xs text-red-700 mt-1">
                                  Storniert
                                  {inv.canceled_at ? ` am ${new Date(inv.canceled_at).toLocaleDateString()}` : ""}
                                  {cancelReason ? ` – ${cancelReason}` : ""}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 w-28 text-right align-top text-slate-900">
                          {inv.gross_total != null ? `${inv.gross_total.toFixed(2)} €` : "–"}
                        </td>
                        <td className="px-3 py-3 w-14 text-right align-top">
                          <MoreMenu
                            items={[
                              { label: "Öffnen", onClick: () => navigate(`/invoices/${inv.id}`) },
                              { label: "Bearbeiten", onClick: () => setModal({ mode: "edit", id: inv.id }) },
                              {
                                label: pdfBusyId === inv.id ? "PDF …" : "PDF öffnen",
                                onClick: () => handlePdfOpen(inv.id),
                                disabled: pdfBusyId === inv.id,
                              },
                              { label: "E-Mail Vorschau", onClick: () => loadPreview(inv.id) },
                              { label: "E-Mail senden", onClick: () => openSend(inv.id, inv.recipient_email || "") },
                              { label: "DATEV Export", onClick: () => onDatevExport(inv.id), disabled: isCanceled },
                              { label: "Als gesendet markieren", onClick: () => markAsSent(inv.id), disabled: isCanceled },
                              { label: "Als bezahlt markieren", onClick: () => markAsPaid(inv.id), disabled: isCanceled },
                              { label: "Löschen", danger: true, onClick: () => onDelete(inv.id) },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {cancelDialog.open && (
        <Modal title="Rechnungen stornieren" onClose={() => !bulkBusy && setCancelDialog({ open: false, reason: "" })}>
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              {selectedCount} Rechnungen werden storniert. Rechnungsnummern bleiben unverändert.
            </p>
            <label className="text-sm text-slate-700 flex flex-col gap-1">
              <span className="font-medium">Grund (optional)</span>
              <Textarea
                value={cancelDialog.reason}
                onChange={(e) => setCancelDialog((prev) => ({ ...prev, reason: e.target.value }))}
                className="min-h-[90px]"
              />
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setCancelDialog({ open: false, reason: "" })} disabled={bulkBusy}>
                Abbrechen
              </Button>
              <Button variant="danger" onClick={submitBulkCancel} disabled={bulkBusy || !selectedCount}>
                {bulkBusy ? "Storniert..." : `Stornieren (${selectedCount})`}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {toast && <Alert type={toast.type === "success" ? "success" : "error"}>{toast.message}</Alert>}

      {modal && (
        <InvoiceFormModal
          mode={modal.mode}
          id={modal.id}
          onClose={() => setModal(null)}
          onSubmitStart={() =>
            setCreateProgress({ open: true, status: "submitting", invoiceId: null, invoiceNumber: undefined, error: null })
          }
          onSaved={(invoiceId, invNumber) => {
            setToast({ type: "success", message: `Rechnung ${invNumber} gespeichert.` });
            navigate(`/invoices/${invoiceId}`);
            load();
          }}
          onSubmitSuccess={async (invoiceId, invNumber) => {
            setCreateProgress({ open: true, status: "submitting", invoiceId, invoiceNumber: invNumber, error: null });
            try {
              await regenerateInvoicePdf(invoiceId);
              setCreateProgress({ open: true, status: "success", invoiceId, invoiceNumber: invNumber, error: null });
            } catch (err: any) {
              const apiErr = err as ApiError;
              setCreateProgress({
                open: true,
                status: "error",
                invoiceId,
                invoiceNumber: invNumber,
                error: apiErr.message || "PDF konnte nicht erstellt werden.",
              });
            }
          }}
          onError={(msg) => setToast({ type: "error", message: msg })}
          onSubmitError={(msg) =>
            setCreateProgress({ open: true, status: "error", invoiceId: null, invoiceNumber: undefined, error: msg || "Fehler" })
          }
        />
      )}

      {(preview.loading || preview.data || preview.error) && (
        <Modal title="E-Mail Vorschau" onClose={() => setPreview({ loading: false, data: null, error: null })}>
          {preview.loading && (
            <div className="flex items-center gap-2 text-slate-600">
              <Spinner /> Lade Vorschau ...
            </div>
          )}
          {preview.error && <Alert type="error">{preview.error}</Alert>}
          {preview.data && (
            <div className="space-y-3 text-sm">
              <div>
                <div className="font-semibold">Betreff</div>
                <div>{preview.data.subject}</div>
              </div>
              <div>
                <div className="font-semibold">HTML</div>
                <div
                  className="border border-slate-200 rounded p-3 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: preview.data.body_html || "<em>(leer)</em>" }}
                />
              </div>
              <div>
                <div className="font-semibold">Text</div>
                <pre className="border border-slate-200 rounded p-3 whitespace-pre-wrap">{preview.data.body_text}</pre>
              </div>
              <div className="text-xs text-slate-600">
                Von: {preview.data.from || "n/a"} | SMTP: {preview.data.smtp_ready ? "konfiguriert" : "fehlt"}
              </div>
            </div>
          )}
        </Modal>
      )}

      {sendModal.open && (
        <Modal title="Rechnung per E-Mail senden" onClose={() => setSendModal({ open: false })}>
          <div className="space-y-3">
            <label className="text-sm text-slate-700">
              <span className="font-medium">Empfänger</span>
              <Input
                value={sendModal.to || ""}
                onChange={(e) => setSendModal((s) => ({ ...s, to: e.target.value }))}
                placeholder="kunde@example.com"
              />
            </label>
            <label className="text-sm text-slate-700">
              <span className="font-medium">Betreff (optional)</span>
              <Input
                value={sendModal.subject || ""}
                onChange={(e) => setSendModal((s) => ({ ...s, subject: e.target.value }))}
              />
            </label>
            <label className="text-sm text-slate-700">
              <span className="font-medium">Nachricht (optional)</span>
              <Textarea
                value={sendModal.message || ""}
                onChange={(e) => setSendModal((s) => ({ ...s, message: e.target.value }))}
                className="min-h-[100px]"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={sendModal.includeDatev || false}
                onChange={(e) => setSendModal((s) => ({ ...s, includeDatev: e.target.checked }))}
              />
              <span>DATEV-Adresse (falls hinterlegt) einbeziehen</span>
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setSendModal({ open: false })}>
                Abbrechen
              </Button>
              <Button onClick={onSendEmail} disabled={busyId === sendModal.id}>
                {busyId === sendModal.id ? "Sendet..." : "Senden"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {createProgress.open && (
        <Modal
          title={
            createProgress.status === "success"
              ? "Rechnung erstellt"
              : createProgress.status === "error"
              ? "Fehler bei der Erstellung"
              : "Rechnung wird erstellt"
          }
          onClose={() => setCreateProgress({ open: false, status: "idle", invoiceId: null, invoiceNumber: undefined, error: null })}
        >
          {createProgress.status === "submitting" && (
            <div className="space-y-4 text-center">
              <div className="flex items-center justify-center">
                <Spinner />
              </div>
              <div className="text-sm text-slate-700">Rechnung wird erstellt. Bitte warten ...</div>
            </div>
          )}
          {createProgress.status === "success" && (
            <div className="space-y-4 text-center">
              <div className="text-sm text-slate-700">Rechnung {createProgress.invoiceNumber || ""} wurde erstellt.</div>
              <div className="flex flex-wrap justify-center gap-3">
                <Button onClick={() => handlePdfOpen(createProgress.invoiceId || 0)}>Rechnung öffnen</Button>
                <Button
                  variant="secondary"
                  onClick={() => navigate(createProgress.invoiceId ? `/invoices/${createProgress.invoiceId}` : "/invoices")}
                >
                  Details öffnen
                </Button>
              </div>
            </div>
          )}
          {createProgress.status === "error" && (
            <div className="space-y-4 text-center">
              <div className="text-sm text-red-700">{createProgress.error || "Erstellung fehlgeschlagen."}</div>
              <div className="flex flex-wrap justify-center gap-3">
                <Button
                  onClick={() => {
                    const confirmed = window.confirm("Bist du sicher? Aktuellen Versuch verwerfen und neu erstellen?");
                    if (!confirmed) return;
                    setCreateProgress({ open: false, status: "idle", invoiceId: null, invoiceNumber: undefined, error: null });
                  }}
                >
                  Löschen und Neu erstellen
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setCreateProgress({ open: false, status: "idle", invoiceId: null, invoiceNumber: undefined, error: null })}
                >
                  Schließen
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function InvoiceCreatePage() {
  const navigate = useNavigate();
  const [toast, setToast] = useState<FormStatus>(null);
  const [createModal, setCreateModal] = useState<{
    open: boolean;
    status: "idle" | "submitting" | "success" | "error";
    invoiceId?: number | null;
    invoiceNumber?: string;
    pdfUrl?: string;
    error?: string | null;
  }>({ open: false, status: "idle" });

  const closeCreateModal = () => {
    setCreateModal({ open: false, status: "idle", invoiceId: null, invoiceNumber: undefined, pdfUrl: undefined, error: null });
  };

  const retryCreate = () => {
    setCreateModal((prev) => ({ ...prev, status: "submitting", error: null, open: true }));
    const formEl = document.getElementById("invoice-form-main") as HTMLFormElement | null;
    if (formEl?.requestSubmit) formEl.requestSubmit();
    else formEl?.submit();
  };

  const openPdf = () => {
    if (!createModal.invoiceId) return;
    const url = `/api/invoices/${createModal.invoiceId}/pdf?mode=inline`;
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) {
      alert("Popup wurde blockiert. Bitte Popups für diese Seite erlauben.");
    }
  };

  return (
    <div className="space-y-4">
      {toast && <Alert type={toast.type === "error" ? "error" : "success"}>{toast.message}</Alert>}
      <InvoiceFormModal
        asPage
        mode="create"
        titleOverride="Neue Rechnung"
        onClose={() => navigate("/invoices")}
        onCancel={() => navigate("/invoices")}
        onSubmitStart={() =>
          setCreateModal({ open: true, status: "submitting", invoiceId: null, invoiceNumber: undefined, pdfUrl: undefined, error: null })
        }
        onSaved={(id, num) => {
          setToast({ type: "success", message: `Rechnung ${num} erstellt.` });
        }}
        onSubmitSuccess={async (id, num) => {
          setCreateModal({
            open: true,
            status: "submitting",
            invoiceId: id,
            invoiceNumber: num,
            pdfUrl: `/api/invoices/${id}/pdf?mode=inline`,
            error: null,
          });
          try {
            await regenerateInvoicePdf(id);
            setCreateModal({
              open: true,
              status: "success",
              invoiceId: id,
              invoiceNumber: num,
              pdfUrl: `/api/invoices/${id}/pdf?mode=inline`,
              error: null,
            });
          } catch (err: any) {
            const apiErr = err as ApiError;
            setCreateModal({
              open: true,
              status: "error",
              invoiceId: id,
              invoiceNumber: num,
              pdfUrl: `/api/invoices/${id}/pdf?mode=inline`,
              error: apiErr.message || "PDF konnte nicht erstellt werden.",
            });
          }
        }}
        onError={(msg) => setToast({ type: "error", message: msg })}
        onSubmitError={(msg) =>
          setCreateModal({ open: true, status: "error", invoiceId: null, invoiceNumber: undefined, pdfUrl: undefined, error: msg || "Fehler" })
        }
      />
      {createModal.open && (
        <Modal
          title={
            createModal.status === "success"
              ? "Rechnung erstellt"
              : createModal.status === "error"
              ? "Fehler bei der Erstellung"
              : "Rechnung wird erstellt"
          }
          onClose={closeCreateModal}
        >
          {createModal.status === "submitting" && (
            <div className="space-y-4 text-center">
              <div className="flex items-center justify-center">
                <Spinner />
              </div>
              <div className="text-sm text-slate-700">Rechnung wird erstellt. Bitte warten ...</div>
              <div className="flex justify-center gap-3">
                <Button variant="secondary" onClick={closeCreateModal} disabled>
                  Abbrechen
                </Button>
              </div>
            </div>
          )}
          {createModal.status === "success" && (
            <div className="space-y-4 text-center">
              <div className="text-sm text-slate-700">
                Rechnung {createModal.invoiceNumber || ""} wurde erstellt.
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <Button onClick={openPdf}>Rechnung öffnen</Button>
                <Button
                  variant="secondary"
                  onClick={() => navigate(createModal.invoiceId ? `/invoices/${createModal.invoiceId}` : "/invoices")}
                >
                  Details öffnen
                </Button>
              </div>
            </div>
          )}
          {createModal.status === "error" && (
            <div className="space-y-4 text-center">
              <div className="text-sm text-red-700">{createModal.error || "Erstellung fehlgeschlagen."}</div>
              <div className="flex flex-wrap justify-center gap-3">
                <Button
                  onClick={() => {
                    const confirmed = window.confirm("Aktuellen Versuch verwerfen und neu erstellen?");
                    if (!confirmed) return;
                    retryCreate();
                  }}
                >
                  Löschen und Neu erstellen
                </Button>
                <Button variant="secondary" onClick={closeCreateModal}>
                  Schließen
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function CustomerFormModal({
  mode,
  customer,
  onClose,
  onSaved,
  onError,
}: {
  mode: "create" | "edit";
  customer?: Customer;
  onClose: () => void;
  onSaved: (c: Customer) => void;
  onError: (msg: string) => void;
}) {
  const [form, setForm] = useState({
    name: customer?.name || "",
    company: customer?.company || "",
    street: customer?.street || "",
    zip: customer?.zip || "",
    city: customer?.city || "",
    email: customer?.email || "",
    phone: customer?.phone || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError("Name ist erforderlich.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        company: form.company.trim() || null,
        street: form.street.trim() || null,
        zip: form.zip.trim() || null,
        city: form.city.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
      };
      if (mode === "create") {
        const res = await createCustomer(payload as any);
        onSaved({ id: res.id, ...payload } as Customer);
      } else if (customer) {
        await updateCustomer(customer.id, payload as any);
        onSaved({ id: customer.id, ...payload } as Customer);
      }
    } catch (err: any) {
      const apiErr = err as ApiError;
      const msg = apiErr.message || "Speichern fehlgeschlagen.";
      setError(msg);
      onError(msg);
      return;
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={mode === "create" ? "Neuer Kunde" : "Kunde bearbeiten"} onClose={onClose}>
      <form className="space-y-3" onSubmit={onSubmit}>
        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-sm text-slate-700">
            <span className="font-medium">Name *</span>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </label>
          <label className="text-sm text-slate-700">
            <span className="font-medium">Firma (optional)</span>
            <Input value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} />
          </label>
          <label className="text-sm text-slate-700">
            <span className="font-medium">E-Mail</span>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </label>
          <label className="text-sm text-slate-700">
            <span className="font-medium">Straße</span>
            <Input
              value={form.street}
              onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
            />
          </label>
          <label className="text-sm text-slate-700">
            <span className="font-medium">PLZ</span>
            <Input value={form.zip} onChange={(e) => setForm((f) => ({ ...f, zip: e.target.value }))} />
          </label>
          <label className="text-sm text-slate-700">
            <span className="font-medium">Ort</span>
            <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
          </label>
          <label className="text-sm text-slate-700">
            <span className="font-medium">Telefon</span>
            <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </label>
        </div>

        {error && <Alert type="error">{error}</Alert>}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">
            Abbrechen
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Speichern ..." : "Speichern"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function InvoiceFormModal({
  mode,
  id,
  onClose,
  onSaved,
  onError,
  asPage = false,
  titleOverride,
  onCancel,
  onSubmitStart,
  onSubmitSuccess,
  onSubmitError,
}: {
  mode: "create" | "edit";
  id?: number;
  onClose?: () => void;
  onSaved: (invoiceId: number, invoiceNumber: string) => void;
  onError?: (msg: string) => void;
  asPage?: boolean;
  titleOverride?: string;
  onCancel?: () => void;
  onSubmitStart?: () => void;
  onSubmitSuccess?: (invoiceId: number, invoiceNumber: string) => void;
  onSubmitError?: (msg: string) => void;
}) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<(InvoiceItem & { unit_price_input?: string })[]>([
    { description: "", quantity: 1, unit_price_gross: 0, unit_price_input: "", vat_key: 1 },
  ]);
  const [form, setForm] = useState({
    recipient_id: "",
    company: "",
    name: "",
    street: "",
    zip: "",
    city: "",
    email: "",
    invoice_number: "",
    date: new Date().toISOString().slice(0, 10),
    b2b: false,
    ust_id: "",
    category_key: "",
    reservation_request_id: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipientOpen, setRecipientOpen] = useState(false);
  const recipientBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const close = onClose || (() => {});
  const handleCancel = () => {
    if (onCancel) onCancel();
    else close();
  };
  const normalizeNumberInput = (val: any) => {
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed === "") return "";
      val = trimmed.replace(",", ".");
    }
    const num = Number(val);
    return Number.isFinite(num) ? num : "";
  };
  const parseNumberValue = (val: any) => {
    if (val === null || val === undefined || val === "") return NaN;
    if (typeof val === "string") {
      val = val.replace(",", ".");
    }
    return Number(val);
  };

  const parsePriceInput = (input: string) => {
    if (input === null || input === undefined) return NaN;
    const raw = String(input).trim();
    if (!raw) return NaN;
    if (raw.endsWith(",") || raw.endsWith(".")) return NaN;
    const normalized = raw.replace(",", ".");
    const num = Number(normalized);
    return Number.isFinite(num) ? num : NaN;
  };

  const loadBase = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [custs, cats, nextNr] = await Promise.all([
        listCustomers(),
        listCategories().catch(() => []),
        mode === "create" ? getNextInvoiceNumber() : Promise.resolve({ next_number: "" }),
      ]);
      setCustomers(custs);
      setCategories(cats);
      if (mode === "create") {
        const nextVal = (nextNr as any).next || (nextNr as any).next_number || "";
        setForm((f) => ({ ...f, invoice_number: nextVal || f.invoice_number }));
      }
      if (mode === "edit" && id) {
        const data = await getInvoice(id);
        setForm({
          recipient_id: data.invoice.recipient.id ? String(data.invoice.recipient.id) : "",
          company: (data.invoice.recipient as any)?.company || "",
          name: data.invoice.recipient.name || "",
          street: data.invoice.recipient.street || "",
          zip: data.invoice.recipient.zip || "",
          city: data.invoice.recipient.city || "",
          email: data.invoice.recipient.email || "",
          invoice_number: data.invoice.invoice_number,
          date: data.invoice.date?.slice(0, 10) || "",
          b2b: data.invoice.b2b === true,
          ust_id: data.invoice.ust_id || "",
          category_key: data.invoice.category || "",
          reservation_request_id: data.invoice.reservation_request_id || "",
        });
        setItems(
          data.items.map((i) => ({
            id: i.id,
            description: i.description,
            quantity: Number(i.quantity),
            unit_price_gross: Number(i.unit_price_gross),
            unit_price_input: i.unit_price_gross !== undefined && i.unit_price_gross !== null ? String(i.unit_price_gross) : "",
            vat_key: Number(i.vat_key),
          }))
        );
      }
    } catch (err: any) {
      const apiErr = err as ApiError;
      const msg = apiErr.message || "Daten konnten nicht geladen werden.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id, mode]);

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  const refreshInvoiceNumber = async () => {
    setError(null);
    try {
      const nextNr = await getNextInvoiceNumber();
      const nextVal = (nextNr as any).next || (nextNr as any).next_number || "";
      if (nextVal) setForm((f) => ({ ...f, invoice_number: nextVal }));
    } catch (err: any) {
      const apiErr = err as ApiError;
      setError(apiErr.message || "Rechnungsnummer konnte nicht ermittelt werden.");
    }
  };

  const findExactCustomerByName = (value: string) => {
    const needle = value.trim().toLowerCase();
    if (!needle) return null;
    const exact = customers.find((c) => (c.name || "").trim().toLowerCase() === needle);
    if (exact) return exact;
    return null;
  };

  const recipientMinChars = 2;
  const recipientSuggestions = useMemo(() => {
    const needle = form.name.trim().toLowerCase();
    if (needle.length < recipientMinChars) return [];
    const list = customers.filter((c) => (c.name || "").trim());
    return list.filter((c) => (c.name || "").trim().toLowerCase().includes(needle)).slice(0, 8);
  }, [customers, form.name]);

  const openRecipientSuggestions = () => {
    if (recipientBlurTimer.current) {
      clearTimeout(recipientBlurTimer.current);
      recipientBlurTimer.current = null;
    }
    setRecipientOpen(true);
  };

  const closeRecipientSuggestions = () => {
    if (recipientBlurTimer.current) clearTimeout(recipientBlurTimer.current);
    recipientBlurTimer.current = setTimeout(() => setRecipientOpen(false), 120);
  };

  const applyRecipientSelection = (value: string, match: Customer | null) => {
    const trimmed = value.trim();
    setForm((f) => {
      const base = {
        ...f,
        name: value,
        recipient_id: match ? String(match.id) : "",
      };
      if (!trimmed) {
        return { ...base, company: "", street: "", zip: "", city: "", email: "" };
      }
      if (match) {
        return {
          ...base,
          company: match.company || "",
          name: match.name || value,
          street: match.street || "",
          zip: match.zip || "",
          city: match.city || "",
          email: match.email || "",
        };
      }
      return base;
    });
  };

  const handleRecipientNameChange = (value: string) => {
    const match = findExactCustomerByName(value);
    applyRecipientSelection(value, match);
  };

  const updateItem = (idx: number, field: keyof InvoiceItem, value: any) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  const addItem = () =>
    setItems((prev) => [...prev, { description: "", quantity: 1, unit_price_gross: 0, unit_price_input: "", vat_key: 1 }]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError("Empfängername ist erforderlich.");
      return;
    }
    if (mode === "edit" && !form.invoice_number.trim()) {
      setError("Rechnungsnummer fehlt.");
      return;
    }
    if (!form.date) {
      setError("Rechnungsdatum fehlt.");
      return;
    }
    const normalizedItems = items.map((i) => ({
      ...i,
      quantity: parseNumberValue(i.quantity),
      unit_price_gross: parsePriceInput(i.unit_price_input ?? String(i.unit_price_gross ?? "")),
    }));

    if (!normalizedItems.length) {
      setError("Mindestens eine Position ist erforderlich.");
      return;
    }
    if (
      normalizedItems.some(
        (i) =>
          !i.description.trim() ||
          !Number.isFinite(i.quantity) ||
          i.quantity <= 0 ||
          !Number.isFinite(i.unit_price_gross) ||
          i.unit_price_gross <= 0
      )
    ) {
      setError("Bitte alle Positionen ausfüllen (Beschreibung, Menge > 0, Preis > 0).");
      return;
    }
    if (form.b2b && !form.ust_id.trim()) {
      setError("Für B2B ist eine USt-ID erforderlich.");
      return;
    }

    setSaving(true);
    if (onSubmitStart) onSubmitStart();
    try {
      const payload = {
        recipient: {
          id: form.recipient_id ? Number(form.recipient_id) : undefined,
          company: form.company.trim() || null,
          name: form.name.trim(),
          street: form.street.trim(),
          zip: form.zip.trim(),
          city: form.city.trim(),
          email: form.email.trim() || null,
        },
        invoice: {
          invoice_number: form.invoice_number.trim(),
          date: form.date,
          b2b: form.b2b,
          ust_id: form.ust_id.trim() || null,
          category: form.category_key || null,
          reservation_request_id: form.reservation_request_id.trim() || null,
        },
        items: normalizedItems.map((i) => ({
          description: i.description.trim(),
          quantity: Number(i.quantity),
          unit_price_gross: Number(i.unit_price_gross),
          vat_key: Number(i.vat_key),
        })),
      };

      if (mode === "create") {
        const res = await createInvoice(payload);
        const createdId = res.invoice_id;
        const invNumber = payload.invoice.invoice_number;
        onSaved(createdId, invNumber);
        if (onSubmitSuccess) onSubmitSuccess(createdId, invNumber);
        if (!asPage) {
          // Reset for modal usage
          setItems([{ description: "", quantity: 1, unit_price_gross: 0, unit_price_input: "", vat_key: 1 }]);
        }
      } else if (id) {
        await updateInvoice(id, payload);
        onSaved(id, payload.invoice.invoice_number);
      }
      if (!asPage) {
        close();
      }
    } catch (err: any) {
      const apiErr = err as ApiError;
      const msg = apiErr.message || "Rechnung konnte nicht gespeichert werden.";
      setError(msg);
      if (onError) onError(msg);
      if (onSubmitError) onSubmitError(msg);
      if (apiErr.status === 400 && msg.toLowerCase().includes("empfänger")) {
        setForm((f) => ({ ...f, recipient_id: "" }));
      }
      // Bei 409 einen neuen Vorschlag übernehmen, falls vorhanden
      const suggested = (err as any)?.data?.suggested_next_number;
      if (apiErr.status === 409 && suggested) {
        setForm((f) => ({ ...f, invoice_number: suggested }));
      }
      return;
    } finally {
      setSaving(false);
    }
  };

  const formContent = loading ? (
    <div className="flex items-center gap-2 text-slate-600">
      <Spinner /> Lade Daten ...
    </div>
  ) : (
    <div className="space-y-5">
      <div className="grid md:grid-cols-2 gap-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Kundendaten</h4>
            <span className="text-xs text-slate-500">Empfänger zuerst erfassen.</span>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="text-sm text-slate-700 md:col-span-2 space-y-1">
              <span className="font-medium">Empfänger / Name *</span>
              <div className="relative">
                <input
                  className="input w-full"
                  value={form.name}
                  onChange={(e) => {
                    handleRecipientNameChange(e.target.value);
                    openRecipientSuggestions();
                  }}
                  onFocus={openRecipientSuggestions}
                  onBlur={closeRecipientSuggestions}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setRecipientOpen(false);
                  }}
                  autoComplete="off"
                  placeholder="Empfänger eingeben oder wählen"
                  required
                />
                {recipientOpen && recipientSuggestions.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-56 overflow-auto">
                    {recipientSuggestions.map((c) => {
                      const label = c.name || "";
                      const subLabel = [c.company, c.email].filter(Boolean).join(" • ");
                      return (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm text-slate-900 hover:bg-slate-100"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            applyRecipientSelection(label, c);
                            setRecipientOpen(false);
                          }}
                        >
                          <div className="font-medium">{label || "–"}</div>
                          {subLabel && <div className="text-xs text-slate-500">{subLabel}</div>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="text-xs text-slate-500">
                Freitext möglich. Wähle einen Vorschlag, um Adressdaten automatisch zu übernehmen.
              </div>
            </label>
            <label className="text-sm text-slate-700 md:col-span-2 space-y-1">
              <span className="font-medium">Firma (optional)</span>
              <Input
                value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                placeholder="Firmenname (optional)"
                maxLength={120}
              />
            </label>
            <label className="text-sm text-slate-700 space-y-1">
              <span className="font-medium">Straße *</span>
              <Input value={form.street} onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))} />
            </label>
            <label className="text-sm text-slate-700 space-y-1">
              <span className="font-medium">PLZ *</span>
              <Input value={form.zip} onChange={(e) => setForm((f) => ({ ...f, zip: e.target.value }))} />
            </label>
            <label className="text-sm text-slate-700 space-y-1">
              <span className="font-medium">Ort *</span>
              <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
            </label>
            <label className="text-sm text-slate-700 space-y-1">
              <span className="font-medium">E-Mail (optional)</span>
              <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              <div className="text-xs text-slate-500">Für E-Mail Versand erforderlich.</div>
            </label>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-semibold">Rechnungsdaten</h4>
            <Button variant="secondary" type="button" onClick={refreshInvoiceNumber}>
              Nächste Nummer
            </Button>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="text-sm text-slate-700 space-y-1">
              <span className="font-medium">Rechnungsnummer *</span>
              <Input
                value={form.invoice_number}
                onChange={(e) => setForm((f) => ({ ...f, invoice_number: e.target.value }))}
                required
              />
            </label>
            <label className="text-sm text-slate-700 space-y-1">
              <span className="font-medium">Datum *</span>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                required
              />
            </label>
            <label className="text-sm text-slate-700 space-y-1">
              <span className="font-medium">Kategorie</span>
              <Select
                value={form.category_key}
                onChange={(e) => setForm((f) => ({ ...f, category_key: e.target.value }))}
              >
                <option value="">– Keine –</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm text-slate-700 space-y-1">
              <span className="font-medium">Forms-ID (optional)</span>
              <Input
                value={form.reservation_request_id}
                onChange={(e) => setForm((f) => ({ ...f, reservation_request_id: e.target.value }))}
                placeholder="Reservation Request ID"
              />
              <span className="text-xs text-slate-500">Für Forms-Sync / Reservation Request.</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
              <input
                type="checkbox"
                checked={form.b2b}
                onChange={(e) => setForm((f) => ({ ...f, b2b: e.target.checked }))}
              />
              <span>B2B (USt-ID Pflicht)</span>
            </label>
            {form.b2b && (
              <label className="text-sm text-slate-700 md:col-span-2 space-y-1">
                <span className="font-medium">USt-ID</span>
                <Input
                  value={form.ust_id}
                  onChange={(e) => setForm((f) => ({ ...f, ust_id: e.target.value }))}
                />
              </label>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold">Positionen</h4>
          <Button variant="secondary" type="button" onClick={addItem}>
            Position hinzufügen
          </Button>
        </div>
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {items.map((item, idx) => (
            <div key={idx} className="grid md:grid-cols-4 gap-3 items-start border border-slate-200 rounded-md p-3">
              <input
                className="input md:col-span-2"
                placeholder="Beschreibung"
                value={item.description}
                onChange={(e) => updateItem(idx, "description", e.target.value)}
              />
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={item.quantity}
                onChange={(e) => updateItem(idx, "quantity", normalizeNumberInput(e.target.value))}
              />
              <input
                className="input"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={
                  item.unit_price_input ??
                  (item.unit_price_gross || item.unit_price_gross === 0 ? String(item.unit_price_gross) : "")
                }
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((it, i) => (i === idx ? { ...it, unit_price_input: e.target.value } : it))
                  )
                }
              />
              <div className="flex gap-2">
                <select
                  className="input flex-1"
                  value={item.vat_key}
                  onChange={(e) => updateItem(idx, "vat_key", Number(e.target.value))}
                >
                  <option value={1}>19% MwSt</option>
                  <option value={2}>7% MwSt</option>
                  <option value={0}>0%</option>
                </select>
                {items.length > 1 && (
                  <Button
                    variant="danger"
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="min-w-[120px]"
                    title="Position entfernen"
                  >
                    Entfernen
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={handleCancel}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? (mode === "create" ? "Erstellen ..." : "Speichern ...") : mode === "create" ? "Erstellen" : "Speichern"}
        </Button>
      </div>
    </div>
  );

  if (asPage) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">{titleOverride || (mode === "create" ? "Neue Rechnung" : "Rechnung bearbeiten")}</h1>
            <p className="text-slate-600 text-sm">Stammdaten und Positionen erfassen.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" type="button" onClick={handleCancel}>
              Abbrechen
            </Button>
            {!loading && (
              <Button type="submit" form="invoice-form-main" disabled={saving}>
                {saving ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner />
                    {mode === "create" ? "Erstellen ..." : "Speichern ..."}
                  </span>
                ) : (
                  mode === "create" ? "Erstellen" : "Speichern"
                )}
              </Button>
            )}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
          {loading ? (
            formContent
          ) : (
            <form id="invoice-form-main" className="space-y-3" onSubmit={onSubmit}>
              {formContent}
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <Modal title={titleOverride || (mode === "create" ? "Neue Rechnung" : "Rechnung bearbeiten")} onClose={close}>
      {loading ? formContent : <form className="space-y-3" onSubmit={onSubmit}>{formContent}</form>}
    </Modal>
  );
}

function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<FormStatus>(null);
  const [busy, setBusy] = useState(false);
  const [sentBusy, setSentBusy] = useState(false);
  const [paidBusy, setPaidBusy] = useState(false);
  const [preview, setPreview] = useState<{ loading: boolean; data: any | null; error: string | null }>({ loading: false, data: null, error: null });
  const [sendModal, setSendModal] = useState<{ open: boolean; to?: string }>({ open: false });
  const [pdfBusy, setPdfBusy] = useState(false);
  const [confirmPdfRegenerate, setConfirmPdfRegenerate] = useState(false);
  const inv = detail?.invoice;
  const isCanceled = Boolean(inv?.canceled_at);
  const cancelReason = (inv?.cancel_reason || "").trim();
  const pdfUrl = detail?.pdf?.url || (inv ? `/api/invoices/${inv.id}/pdf?mode=inline` : "");
  const pdfFilename =
    detail?.pdf?.filename ||
    (() => {
      if (detail?.pdf?.location) {
        const parts = detail.pdf.location.split(/[\\/]/);
        const last = parts[parts.length - 1];
        if (last) {
          try {
            return decodeURIComponent(last);
          } catch {
            return last;
          }
        }
      }
      if (pdfUrl) {
        try {
          const parsed = new URL(pdfUrl, window.location.origin);
          const seg = parsed.pathname.split("/").filter(Boolean).pop();
          if (seg) return decodeURIComponent(seg);
        } catch {
          // ignore
        }
      }
      return inv ? `RE-${inv.invoice_number}.pdf` : "–";
    })();
  const pdfLocation = detail?.pdf?.location || "";
  const shortLocation =
    pdfLocation && pdfLocation.length > 64
      ? `${pdfLocation.slice(0, 28)}…${pdfLocation.slice(-18)}`
      : pdfLocation || "–";
  const items = detail?.items ?? [];

  const vatSummary = useMemo(() => {
    if (!inv) {
      return { rows: [], totalNet: 0, totalVat: 0, totalGross: 0 };
    }
    const rows: { rateLabel: string; net: number; vat: number; gross: number }[] = [];
    const addRow = (rateLabel: string, net?: number | null, vat?: number | null, gross?: number | null) => {
      const netVal = Number(net ?? 0);
      const vatVal = Number(vat ?? 0);
      const grossVal = Number.isFinite(Number(gross)) ? Number(gross) : netVal + vatVal;
      if (Math.abs(netVal) < 0.0001 && Math.abs(vatVal) < 0.0001 && Math.abs(grossVal) < 0.0001) return;
      rows.push({ rateLabel, net: netVal, vat: vatVal, gross: grossVal });
    };

    const hasAggregates =
      inv.net_19 != null || inv.vat_19 != null || inv.gross_19 != null || inv.net_7 != null || inv.vat_7 != null || inv.gross_7 != null;

    if (hasAggregates) {
      addRow("19%", inv.net_19, inv.vat_19, inv.gross_19 ?? (inv.net_19 ?? 0) + (inv.vat_19 ?? 0));
      addRow("7%", inv.net_7, inv.vat_7, inv.gross_7 ?? (inv.net_7 ?? 0) + (inv.vat_7 ?? 0));
    }

    if (!rows.length && inv.gross_total != null) {
      addRow("19%", inv.net_19, inv.vat_19, inv.gross_19 ?? (inv.net_19 || 0) + (inv.vat_19 || 0));
      addRow("7%", inv.net_7, inv.vat_7, inv.gross_7 ?? (inv.net_7 || 0) + (inv.vat_7 || 0));
    }

    const totalNet = rows.reduce((sum, r) => sum + (r.net || 0), 0);
    const totalVat = rows.reduce((sum, r) => sum + (r.vat || 0), 0);
    const totalGross = rows.reduce((sum, r) => sum + (r.gross || 0), 0);

    return { rows, totalNet, totalVat, totalGross };
  }, [inv]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getInvoice(Number(id));
      setDetail(data);
    } catch (err: any) {
      const apiErr = err as ApiError;
      setError(apiErr.message || "Rechnung konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const statusBadge = () => {
    if (!detail) return null;
    if (detail.invoice.canceled_at) return <Badge tone="gray">Storniert</Badge>;
    if (detail.invoice.status_paid_at) return <Badge tone="green">Bezahlt</Badge>;
    if (detail.invoice.status_sent) return <Badge tone="blue">Gesendet</Badge>;
    return <Badge tone="amber">Offen</Badge>;
  };

  const onRegenerate = async () => {
    if (!detail) return;
    setBusy(true);
    setToast(null);
    try {
      await regenerateInvoicePdf(detail.invoice.id);
      window.open(`/api/invoices/${detail.invoice.id}/pdf?mode=inline`, "_blank");
      setToast({ type: "success", message: "PDF neu erstellt." });
    } catch (err: any) {
      const apiErr = err as ApiError;
      setToast({ type: "error", message: apiErr.message || "PDF konnte nicht neu erstellt werden." });
    } finally {
      setBusy(false);
    }
  };

  const onMarkSent = async () => {
    if (!detail) return;
    if (detail.invoice.canceled_at) {
      setToast({ type: "error", message: "Stornierte Rechnungen können nicht neu markiert werden." });
      return;
    }
    setBusy(true);
    setSentBusy(true);
    setToast(null);
    try {
      await markInvoiceSent(detail.invoice.id);
      setDetail((prev) =>
        prev ? { ...prev, invoice: { ...prev.invoice, status_sent: true, status_sent_at: new Date().toISOString() } } : prev
      );
      setToast({ type: "success", message: "Als gesendet markiert." });
    } catch (err: any) {
      const apiErr = err as ApiError;
      setToast({ type: "error", message: apiErr.message || "Konnte nicht markieren." });
    } finally {
      setBusy(false);
      setSentBusy(false);
    }
  };

  const onMarkPaid = async () => {
    if (!detail) return;
    if (detail.invoice.canceled_at) {
      setToast({ type: "error", message: "Stornierte Rechnungen können nicht neu markiert werden." });
      return;
    }
    setBusy(true);
    setPaidBusy(true);
    setToast(null);
    try {
      await markInvoicePaid(detail.invoice.id);
      setDetail((prev) =>
        prev ? { ...prev, invoice: { ...prev.invoice, status_paid_at: new Date().toISOString() } } : prev
      );
      setToast({ type: "success", message: "Als bezahlt markiert." });
    } catch (err: any) {
      const apiErr = err as ApiError;
      setToast({ type: "error", message: apiErr.message || "Konnte nicht markieren." });
    } finally {
      setBusy(false);
      setPaidBusy(false);
    }
  };

  const loadPreview = async () => {
    if (!detail) return;
    setPreview({ loading: true, data: null, error: null });
    try {
      const data = await getInvoiceEmailPreview(detail.invoice.id);
      setPreview({ loading: false, data, error: null });
    } catch (err: any) {
      const apiErr = err as ApiError;
      let msg = apiErr.message || "Vorschau konnte nicht geladen werden.";
      if (apiErr.status === 400 && msg.toLowerCase().includes("smtp")) {
        msg = "E-Mail Versand ist nicht konfiguriert (SMTP). Bitte Einstellungen prüfen.";
      }
      setPreview({ loading: false, data: null, error: msg });
    }
  };

  const onSendEmail = async () => {
    if (!detail) return;
    if (!sendModal.to || !sendModal.to.trim()) {
      setToast({ type: "error", message: "Bitte Empfänger-E-Mail angeben." });
      return;
    }
    setBusy(true);
    setToast(null);
    try {
      const res = await sendInvoiceEmailApi(detail.invoice.id, { to: sendModal.to.trim() });
      setToast({ type: "success", message: res.message || "E-Mail gesendet." });
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              invoice: { ...prev.invoice, status_sent: true, status_sent_at: new Date().toISOString() },
            }
          : prev
      );
      setSendModal({ open: false });
    } catch (err: any) {
      const apiErr = err as ApiError;
      let msg = apiErr.message || "E-Mail konnte nicht gesendet werden.";
      if (apiErr.status === 400 && msg.toLowerCase().includes("smtp")) {
        msg = "E-Mail Versand ist nicht konfiguriert (SMTP). Bitte Einstellungen prüfen.";
      }
      setToast({ type: "error", message: msg });
    } finally {
      setBusy(false);
    }
  };

  const onDatevExport = async () => {
    if (!detail) return;
    if (detail.invoice.canceled_at) {
      setToast({ type: "error", message: "Stornierte Rechnungen werden nicht exportiert." });
      return;
    }
    setBusy(true);
    setToast(null);
    try {
      const res = await exportInvoiceDatev(detail.invoice.id);
      setToast({ type: "success", message: res.message || "DATEV Export gestartet." });
    } catch (err: any) {
      const apiErr = err as ApiError;
      setToast({ type: "error", message: apiErr.message || "DATEV Export fehlgeschlagen." });
    } finally {
      setBusy(false);
    }
  };

  const openDetailPdf = () => {
    if (!detail) return;
    const hasQuery = pdfUrl.includes("?");
    const url = `${pdfUrl}${hasQuery ? "&" : "?"}mode=inline`;
    const popup = window.open("about:blank", "_blank");
    if (!popup) {
      setToast({ type: "error", message: "Popup wurde blockiert. Bitte Popups für diese Seite erlauben." });
      return;
    }
    try {
      popup.opener = null;
    } catch {
      // ignore
    }
    popup.location.href = url;
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-600">
        <Spinner /> Lade Rechnung ...
      </div>
    );
  }

  if (error || !detail || !inv) {
    return (
      <div className="space-y-3">
        <Alert type="error">{error || "Rechnung nicht gefunden."}</Alert>
        <Button variant="secondary" onClick={() => navigate("/invoices")}>
          Zurück zur Übersicht
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Rechnung {inv.invoice_number}</h1>
          <p className="text-slate-600 text-sm">Details und Aktionen</p>
          {isCanceled && (
            <p className="text-sm text-red-700 mt-1">
              Storniert{inv.canceled_at ? ` am ${new Date(inv.canceled_at).toLocaleDateString()}` : ""}
              {cancelReason ? ` – ${cancelReason}` : ""}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          {statusBadge()}
          <Button
            variant={inv.status_sent ? "secondary" : "primary"}
            onClick={onMarkSent}
            disabled={isCanceled || Boolean(inv.status_sent) || sentBusy}
          >
            {inv.status_sent ? "Versendet" : sentBusy ? "Markiere..." : "Als versendet markieren"}
          </Button>
          <Button
            variant={inv.status_paid_at ? "secondary" : "primary"}
            onClick={onMarkPaid}
            disabled={isCanceled || Boolean(inv.status_paid_at) || paidBusy}
          >
            {inv.status_paid_at ? "Bezahlt" : paidBusy ? "Markiere..." : "Als bezahlt markieren"}
          </Button>
          <MoreMenu
            items={[
              {
                label: pdfBusy ? "PDF …" : "PDF öffnen",
                onClick: openDetailPdf,
                disabled: pdfBusy,
              },
              { label: "E-Mail Vorschau", onClick: loadPreview },
              { label: "E-Mail senden", onClick: () => setSendModal({ open: true, to: inv.recipient.email || "" }) },
              { label: "DATEV Export", onClick: onDatevExport, disabled: isCanceled },
            ]}
          />
        </div>
      </div>

      {toast && <Alert type={toast.type === "success" ? "success" : "error"}>{toast.message}</Alert>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,520px)]">
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <span>Datum: {inv.date ? new Date(inv.date).toLocaleDateString() : "–"}</span>
              <span>•</span>
              <span>Kategorie: {inv.category || "–"}</span>
              <span>•</span>
              <span>
                Forms-ID: {inv.reservation_request_id ? <code className="text-[11px]">{inv.reservation_request_id}</code> : "–"}
              </span>
            </div>
            <div className="text-3xl font-semibold">
              {inv.gross_total != null
                ? inv.gross_total.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"
                : "–"}
            </div>
            <div className="grid sm:grid-cols-2 gap-2 text-sm text-slate-700">
              <div className="text-xs uppercase text-slate-500">B2B</div>
              <div>{inv.b2b ? "Ja" : "Nein"}</div>
              {inv.ust_id && (
                <>
                  <div className="text-xs uppercase text-slate-500">USt-ID</div>
                  <div>{inv.ust_id}</div>
                </>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-2">
            <div className="text-xs uppercase text-slate-500">Empfänger</div>
            {inv.recipient.company && <div className="text-slate-900 font-semibold">{inv.recipient.company}</div>}
            <div className="text-slate-900 font-semibold">{inv.recipient.name || "–"}</div>
            <div className="text-slate-600 text-sm">
              {[inv.recipient.street, `${inv.recipient.zip || ""} ${inv.recipient.city || ""}`.trim()].filter(Boolean).join(", ") || "–"}
            </div>
            <div className="text-slate-600 text-sm">{inv.recipient.email || "–"}</div>
            <div className="text-slate-600 text-sm">{inv.recipient.phone || "–"}</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase text-slate-500">Positionen</div>
            </div>
            <div className="space-y-2">
              {items.map((it) => (
                <div key={it.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="flex justify-between text-sm text-slate-900 font-medium">
                    <span className="truncate">{it.description || "–"}</span>
                    <span>
                      {Number(it.line_total_gross ?? it.unit_price_gross).toLocaleString("de-DE", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      €
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 flex gap-3 mt-1">
                    <span>Menge: {Number(it.quantity).toLocaleString("de-DE")}</span>
                    <span>Preis: {Number(it.unit_price_gross).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                    <span>
                      MwSt: {it.vat_key === 1 ? "19%" : it.vat_key === 2 ? "7%" : `${it.vat_key}%`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-2">
            <div className="text-xs uppercase text-slate-500">Status</div>
            <div className="flex items-center gap-2 text-sm text-slate-800">
              {statusBadge()}{" "}
              <span>
                {inv.status_paid_at
                  ? `Bezahlt am ${new Date(inv.status_paid_at).toLocaleString()}`
                  : inv.status_sent
                  ? `Gesendet am ${inv.status_sent_at ? new Date(inv.status_sent_at).toLocaleString() : ""}`
                  : "Offen"}
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-2">
            <div className="text-xs uppercase text-slate-500">Verlauf</div>
            <div className="text-sm text-slate-700 space-y-1">
              <div>Gesendet: {inv.status_sent_at ? new Date(inv.status_sent_at).toLocaleString() : "–"}</div>
              <div>Bezahlt: {inv.status_paid_at ? new Date(inv.status_paid_at).toLocaleString() : "–"}</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-2">
            <div className="text-xs uppercase text-slate-500">Beträge</div>
            {vatSummary.rows.length ? (
              <div className="overflow-x-auto overflow-y-visible border border-slate-100 rounded-lg">
                <table className="min-w-full text-sm table-auto">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase whitespace-nowrap">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Satz</th>
                      <th className="px-3 py-2 text-right font-semibold">Netto</th>
                      <th className="px-3 py-2 text-right font-semibold">MwSt</th>
                      <th className="px-3 py-2 text-right font-semibold">Brutto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 whitespace-nowrap">
                    {vatSummary.rows.map((row) => (
                      <tr key={row.rateLabel} className="text-slate-800">
                        <td className="px-3 py-2 font-medium">{row.rateLabel}</td>
                        <td className="px-3 py-2 text-right">
                          {row.net.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                        </td>
                        <td className="px-3 py-2 text-right">
                          {row.vat.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                        </td>
                        <td className="px-3 py-2 text-right">
                          {row.gross.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="whitespace-nowrap">
                    <tr className="bg-slate-50 font-semibold text-slate-900 border-t border-slate-200">
                      <td className="px-3 py-2 text-left">Gesamt</td>
                      <td className="px-3 py-2 text-right">
                        {vatSummary.totalNet.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                      </td>
                      <td className="px-3 py-2 text-right">
                        {vatSummary.totalVat.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                      </td>
                      <td className="px-3 py-2 text-right">
                        {vatSummary.totalGross.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="text-sm text-slate-700">Keine Beträge verfügbar.</div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-1 text-sm text-slate-700">
            <div className="text-xs uppercase text-slate-500">DATEV</div>
            <div>
              {inv.datev_export_status
                ? inv.datev_export_status === "SUCCESS"
                  ? `✅ ${inv.datev_exported_at ? new Date(inv.datev_exported_at).toLocaleString() : ""}`.trim()
                  : inv.datev_export_status === "FAILED"
                  ? `❌ ${inv.datev_export_error || ""}`.trim()
                  : inv.datev_export_status === "SKIPPED"
                  ? `⏭️ ${inv.datev_export_error || ""}`.trim()
                  : inv.datev_export_status
                : "–"}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-1 text-sm text-slate-700">
            <div className="text-xs uppercase text-slate-500">PDF</div>
            <div className="space-y-2">
              <div>
                <div className="text-[11px] uppercase text-slate-500">Datei</div>
                <div className="font-semibold text-slate-900 break-all">{pdfFilename}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase text-slate-500">Ablageort</div>
                <div className="break-all text-slate-800" title={pdfLocation || undefined}>{shortLocation}</div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button variant="secondary" onClick={openDetailPdf} disabled={pdfBusy}>
                  {pdfBusy ? "Öffne..." : "PDF öffnen"}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmPdfRegenerate(true)} disabled={pdfBusy || isCanceled}>
                  {pdfBusy ? "Bitte warten..." : "PDF neu erstellen"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {confirmPdfRegenerate && (
        <Modal title="PDF neu erstellen" onClose={() => setConfirmPdfRegenerate(false)}>
          <div className="space-y-3 text-sm text-slate-700">
            <p>Möchtest du das PDF wirklich neu erstellen? Die bestehende Datei wird überschrieben bzw. in den Trash verschoben.</p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setConfirmPdfRegenerate(false)}>
                Abbrechen
              </Button>
              <Button
                onClick={() => {
                  setConfirmPdfRegenerate(false);
                  onRegenerate();
                }}
                disabled={pdfBusy || isCanceled}
              >
                Ja, neu erstellen
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {(preview.loading || preview.data || preview.error) && (
        <Modal title="E-Mail Vorschau" onClose={() => setPreview({ loading: false, data: null, error: null })}>
          {preview.loading && (
            <div className="flex items-center gap-2 text-slate-600">
              <Spinner /> Lade Vorschau ...
            </div>
          )}
          {preview.error && <Alert type="error">{preview.error}</Alert>}
          {preview.data && (
            <div className="space-y-3 text-sm">
              <div>
                <div className="font-semibold">Betreff</div>
                <div>{preview.data.subject}</div>
              </div>
              <div>
                <div className="font-semibold">HTML</div>
                <div
                  className="border border-slate-200 rounded p-3 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: preview.data.body_html || "<em>(leer)</em>" }}
                />
              </div>
              <div>
                <div className="font-semibold">Text</div>
                <pre className="border border-slate-200 rounded p-3 whitespace-pre-wrap">{preview.data.body_text}</pre>
              </div>
            </div>
          )}
        </Modal>
      )}

      {sendModal.open && (
        <Modal title="Rechnung per E-Mail senden" onClose={() => setSendModal({ open: false })}>
          <div className="space-y-3">
            <label className="text-sm text-slate-700">
              <span className="font-medium">Empfänger</span>
              <Input
                value={sendModal.to || ""}
                onChange={(e) => setSendModal((s) => ({ ...s, to: e.target.value }))}
                placeholder="kunde@example.com"
              />
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setSendModal({ open: false })}>
                Abbrechen
              </Button>
              <Button onClick={onSendEmail} disabled={busy}>
                {busy ? "Sendet..." : "Senden"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CategoryFormModal({
  mode,
  category,
  logos,
  onClose,
  onSaved,
  onError,
}: {
  mode: "create" | "edit";
  category?: Category;
  logos: string[];
  onClose: () => void;
  onSaved: (c: Category) => void;
  onError: (msg: string) => void;
}) {
  const [form, setForm] = useState({
    key: category?.key || "",
    label: category?.label || "",
    logo_file: category?.logo_file || "",
  });
  const [availableLogos, setAvailableLogos] = useState<string[]>(logos || []);
  const [template, setTemplate] = useState<{ subject: string; body_text: string }>({
    subject: category?.template?.subject || "",
    body_text: category?.template?.body_text || "",
  });
  const [email, setEmail] = useState({
    email_address: category?.email_account?.email_address || "",
    display_name: category?.email_account?.display_name || "",
    smtp_host: category?.email_account?.smtp_host || "",
    smtp_port: category?.email_account?.smtp_port ? String(category?.email_account?.smtp_port) : "",
    smtp_secure: category?.email_account?.smtp_secure ?? true,
    smtp_user: category?.email_account?.smtp_user || "",
    smtp_pass: "",
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<FormStatus>(null);

  useEffect(() => {
    // load template/email for edit
    if (mode === "edit" && category) {
      Promise.all([
        getCategoryTemplateApi(category.id).catch(() => null),
        getCategoryEmailApi(category.id).catch(() => null),
        listCategoryLogos().catch(() => []),
      ]).then(([tpl, mail, logos]) => {
        if (tpl) setTemplate({ subject: tpl.subject || "", body_text: tpl.body_text || "" });
        if (mail) {
          setEmail({
            email_address: mail.email_address || "",
            display_name: mail.display_name || "",
            smtp_host: mail.smtp_host || "",
            smtp_port: mail.smtp_port ? String(mail.smtp_port) : "",
            smtp_secure: mail.smtp_secure ?? true,
            smtp_user: mail.smtp_user || "",
            smtp_pass: "",
          });
        }
        if (logos?.length) setAvailableLogos(logos);
      });
    } else {
      listCategoryLogos().then((l) => setAvailableLogos(l)).catch(() => {});
    }
  }, [category, mode]);

  const onFileSelect = async (file?: File) => {
    if (!file) return;
    const extOk = /\.(png|jpg|jpeg|svg)$/i.test(file.name);
    if (!extOk) {
      setStatus({ type: "error", message: "Nur PNG/JPG/SVG erlaubt." });
      return;
    }
    if (file.size > 1.5 * 1024 * 1024) {
      setStatus({ type: "error", message: "Datei zu groß (max 1.5 MB)." });
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      try {
        const res = await uploadCategoryLogo(file.name, dataUrl);
        setForm((f) => ({ ...f, logo_file: res.filename }));
        if (!availableLogos.includes(res.filename)) {
          setAvailableLogos((prev) => [...prev, res.filename]);
        }
        setStatus({ type: "success", message: "Logo hochgeladen." });
      } catch (err: any) {
        const apiErr = err as ApiError;
        setStatus({ type: "error", message: apiErr.message || "Upload fehlgeschlagen." });
      }
    };
    reader.readAsDataURL(file);
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    if (!form.key.trim() || !form.label.trim() || !form.logo_file) {
      setStatus({ type: "error", message: "Key, Label und Logo sind erforderlich." });
      return;
    }
    setLoading(true);
    try {
      let saved: Category;
      if (mode === "create") {
        saved = await apiCreateCategory({
          key: form.key.trim(),
          label: form.label.trim(),
          logo_file: form.logo_file,
        });
      } else if (category) {
        saved = await apiUpdateCategory(category.id, {
          key: form.key.trim(),
          label: form.label.trim(),
          logo_file: form.logo_file,
        });
      } else {
        throw new Error("Ungültiger Zustand");
      }

      // Template speichern (optional)
      if (template.subject && template.body_text) {
        await saveCategoryTemplateApi(saved.id, template);
      }
      // Email speichern, wenn Daten vorhanden
      if (email.email_address || email.smtp_host || email.smtp_user || email.smtp_pass) {
        await saveCategoryEmailApi(saved.id, {
          display_name: email.display_name || null,
          email_address: email.email_address || null,
          smtp_host: email.smtp_host || null,
          smtp_port: email.smtp_port ? Number(email.smtp_port) : null,
          smtp_secure: email.smtp_secure,
          smtp_user: email.smtp_user || null,
          smtp_pass: email.smtp_pass || undefined,
        });
      }

      onSaved({ ...saved });
    } catch (err: any) {
      const apiErr = err as ApiError;
      const msg = apiErr.message || "Kategorie konnte nicht gespeichert werden.";
      setStatus({ type: "error", message: msg });
      onError(msg);
      return;
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={mode === "create" ? "Neue Kategorie" : "Kategorie bearbeiten"} onClose={onClose}>
      <form className="space-y-3" onSubmit={onSave}>
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Key">
            <Input value={form.key} onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))} required />
          </Field>
          <Field label="Label">
            <Input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} required />
          </Field>
        </div>
        <div className="space-y-2">
          <div className="text-sm text-slate-700 font-medium">Logo</div>
          <div className="flex flex-wrap gap-2 items-center">
            <select
              className="input w-48"
              value={form.logo_file}
              onChange={(e) => setForm((f) => ({ ...f, logo_file: e.target.value }))}
            >
              <option value="">– Logo wählen –</option>
              {availableLogos.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.svg"
              onChange={(e) => onFileSelect(e.target.files?.[0])}
            />
            {form.logo_file && (
              <img
                src={`/logos/${form.logo_file}`}
                alt="Logo"
                className="w-12 h-12 object-contain border border-slate-200 rounded"
              />
            )}
          </div>
          <p className="text-xs text-slate-500">PNG/JPG/SVG, max 1.5 MB.</p>
        </div>

        <div className="space-y-2">
          <div className="font-semibold text-sm">E-Mail/SMTP (optional)</div>
          <div className="grid md:grid-cols-2 gap-2">
            <Input
              placeholder="Absender-Name"
              value={email.display_name}
              onChange={(e) => setEmail((f) => ({ ...f, display_name: e.target.value }))}
            />
            <Input
              placeholder="Absender-E-Mail"
              value={email.email_address}
              onChange={(e) => setEmail((f) => ({ ...f, email_address: e.target.value }))}
            />
            <Input
              placeholder="SMTP Host"
              value={email.smtp_host || ""}
              onChange={(e) => setEmail((f) => ({ ...f, smtp_host: e.target.value }))}
            />
            <Input
              placeholder="SMTP Port"
              value={email.smtp_port}
              onChange={(e) => setEmail((f) => ({ ...f, smtp_port: e.target.value }))}
            />
            <label className="text-sm text-slate-700 flex items-center gap-2">
              <input
                type="checkbox"
                checked={email.smtp_secure}
                onChange={(e) => setEmail((f) => ({ ...f, smtp_secure: e.target.checked }))}
              />
              <span>SMTP Secure</span>
            </label>
            <Input
              placeholder="SMTP User"
              value={email.smtp_user || ""}
              onChange={(e) => setEmail((f) => ({ ...f, smtp_user: e.target.value }))}
            />
            <Input
              placeholder="SMTP Passwort (write-only)"
              type="password"
              value={email.smtp_pass}
              onChange={(e) => setEmail((f) => ({ ...f, smtp_pass: e.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="font-semibold text-sm">Template (optional)</div>
          <Input
            placeholder="Betreff"
            value={template.subject}
            onChange={(e) => setTemplate((t) => ({ ...t, subject: e.target.value }))}
          />
          <Textarea
            placeholder="Text Body"
            value={template.body_text}
            onChange={(e) => setTemplate((t) => ({ ...t, body_text: e.target.value }))}
            className="min-h-[120px]"
          />
          <div className="space-y-1">
            <div className="text-xs text-slate-600">Platzhalter (Plain Text, wird 1:1 ersetzt):</div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-700">
              {EMAIL_PLACEHOLDERS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="px-2 py-1 border border-slate-200 rounded bg-slate-50 hover:bg-slate-100"
                  onClick={() =>
                    setTemplate((t) => ({
                      ...t,
                      body_text: t.body_text ? `${t.body_text}${t.body_text.endsWith("\n") ? "" : "\n"}${p}` : p,
                    }))
                  }
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {status && <Alert type={status.type === "success" ? "success" : "error"}>{status.message}</Alert>}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Speichern ..." : "Speichern"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function AdminSettings() {
  const { user } = useAuth();
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const versionDetail = useMemo(() => formatVersionDetail(versionInfo), [versionInfo]);
  const isAdminUser = user?.role_name === "admin";

  const tabs = [
    { key: "pdf", label: "PDF" },
    { key: "branding", label: "Branding" },
    { key: "mail", label: "Mail / SMTP" },
    { key: "email_templates", label: "E-Mail Vorlagen" },
    { key: "invoices", label: "Rechnungen" },
    { key: "datev", label: "DATEV" },
    { key: "hkforms", label: "Forms-Sync" },
    { key: "backups", label: "Backups" },
    { key: "network", label: "Netzwerk" },
    { key: "security", label: "Sicherheit" },
  ];

  const [active, setActive] = useState(tabs[0].key);
  useEffect(() => {
    getVersion()
      .then(setVersionInfo)
      .catch(() => setVersionInfo(null));
  }, []);
  const activeContent = (key: string) => {
    switch (key) {
      case "pdf":
        return <PdfSettingsInfo />;
      case "branding":
        return <FaviconSettingsForm />;
      case "mail":
        return <SmtpSettingsForm />;
      case "email_templates":
        return <EmailTemplatesSettings />;
      case "invoices":
        return <InvoiceSettingsForm />;
      case "datev":
        return <DatevSettingsForm />;
      case "hkforms":
        return (
          <div className="space-y-6">
            <HkformsSettingsForm />
            <ApiKeysSection />
          </div>
        );
      case "backups":
        return <BackupSettingsPanel />;
      case "network":
        return <NetworkSettingsForm />;
      case "security":
        return <SecuritySettingsInfo />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <header className="mb-2">
        <h1 className="text-2xl font-bold mb-1">Einstellungen</h1>
        <p className="text-slate-700 text-sm">
          System-Einstellungen im macOS-Stil. Wähle links einen Bereich, rechts erscheint das passende Pane.
        </p>
      </header>

      {!isAdminUser ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-4">
          Keine Berechtigung. Nur Admins können die Einstellungen bearbeiten.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 flex flex-col md:flex-row gap-4">
          <div className="w-full md:w-60 flex-shrink-0">
            <div className="hidden md:block">
              <nav className="flex flex-col gap-1">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setActive(t.key)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition border ${
                      active === t.key
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "border-transparent hover:bg-slate-100 text-slate-700"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </nav>
            </div>
            <div className="md:hidden">
              <select value={active} onChange={(e) => setActive(e.target.value)} className="input">
                {tabs.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="border border-slate-200 rounded-2xl shadow-sm bg-white p-4 space-y-4">
              {activeContent(active)}
            </div>
          </div>
        </div>
      )}
      {versionDetail && <div className="text-xs text-slate-600">{versionDetail}</div>}
    </div>
  );
}

function PdfSettingsInfo() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<FormStatus>(null);
  const [testStatus, setTestStatus] = useState<FormStatus>(null);
  const [form, setForm] = useState<{ storage_path: string; archive_path?: string | null; trash_path?: string | null; default_path?: string; default_archive?: string | null; default_trash?: string | null }>({ storage_path: "" });

  useEffect(() => {
    setStatus(null);
    getPdfSettings()
      .then((data) =>
        setForm({
          storage_path: data.storage_path || "",
          archive_path: data.archive_path || "",
          trash_path: data.trash_path || "",
          default_path: data.default_path,
          default_archive: data.default_archive,
          default_trash: data.default_trash,
        })
      )
      .catch((err: ApiError) => setStatus({ type: "error", message: err.message || "Konnte PDF-Einstellungen nicht laden." }))
      .finally(() => setLoading(false));
  }, []);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const saved = await updatePdfSettings({
        storage_path: form.storage_path,
        archive_path: form.archive_path || null,
        trash_path: form.trash_path || null,
      });
      setForm((f) => ({
        ...f,
        storage_path: saved.storage_path,
        archive_path: saved.archive_path || "",
        trash_path: saved.trash_path || "",
        default_archive: saved.default_archive,
        default_trash: saved.default_trash,
      }));
      setStatus({ type: "success", message: "PDF-Pfad gespeichert." });
    } catch (err: any) {
      const apiErr = err as ApiError;
      setStatus({ type: "error", message: apiErr.message || "Speichern fehlgeschlagen." });
    } finally {
      setSaving(false);
    }
  };

  const onTest = async () => {
    setTesting(true);
    setTestStatus(null);
    try {
    const res = await testPdfPath({ path: form.storage_path });
    setTestStatus({ type: "success", message: `Pfad ist schreibbar: ${res.path}` });
  } catch (err: any) {
    const apiErr = err as ApiError;
    setTestStatus({ type: "error", message: apiErr.message || "Pfad-Test fehlgeschlagen." });
  } finally {
    setTesting(false);
  }
};

  const resetDefault = () => {
    setForm((f) => ({
      ...f,
      storage_path: f.default_path || "",
      archive_path: f.default_archive || "",
      trash_path: f.default_trash || "",
    }));
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">PDF Speicherort</h2>
        <p className="text-sm text-slate-600">
          Pfad, in dem PDFs gespeichert werden. Bei Docker als Volume/Bind-Mount bereitstellen. Default: {form.default_path || "/app/pdfs"}.
        </p>
      </div>
      <form className="space-y-3" onSubmit={onSave}>
        <label className="text-sm text-slate-700 block">
          <span className="font-medium">Pfad</span>
          <input
            className="input mt-1"
            value={form.storage_path}
            onChange={(e) => setForm((f) => ({ ...f, storage_path: e.target.value }))}
            disabled={loading}
          />
        </label>
        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-sm text-slate-700 block">
            <span className="font-medium">Archiv-Pfad (optional)</span>
            <input
              className="input mt-1"
              value={form.archive_path || ""}
              onChange={(e) => setForm((f) => ({ ...f, archive_path: e.target.value }))}
              disabled={loading}
              placeholder={form.default_archive || "/app/pdfs/archive"}
            />
          </label>
          <label className="text-sm text-slate-700 block">
            <span className="font-medium">Trash-Pfad (optional)</span>
            <input
              className="input mt-1"
              value={form.trash_path || ""}
              onChange={(e) => setForm((f) => ({ ...f, trash_path: e.target.value }))}
              disabled={loading}
              placeholder={form.default_trash || "/app/pdfs/trash"}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" type="submit" disabled={saving || loading}>
            {saving ? "Speichere ..." : "Speichern"}
          </button>
          <button className="btn-secondary" type="button" onClick={onTest} disabled={testing || loading}>
            {testing ? "Testet ..." : "Pfad testen"}
          </button>
          {form.default_path && (
            <button className="btn-secondary" type="button" onClick={resetDefault} disabled={loading}>
              Auf Standard zurücksetzen
            </button>
          )}
        </div>
      </form>
      {status && (
        <Alert type={status.type === "error" ? "error" : "success"}>{status.message}</Alert>
      )}
      {testStatus && (
        <Alert type={testStatus.type === "error" ? "error" : "success"}>{testStatus.message}</Alert>
      )}
    </div>
  );
}

function FaviconSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<FormStatus>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    setStatus(null);
    getFaviconSettings()
      .then((data) => {
        setPreviewUrl(data.url || "/favicon.ico");
        setUpdatedAt(data.updated_at || null);
      })
      .catch((err: ApiError) => {
        setStatus({ type: "error", message: err.message || "Favicon konnte nicht geladen werden." });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleFileChange = async (file?: File | null) => {
    if (!file) return;
    setStatus(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      try {
        const res = await uploadFavicon({ data_url: dataUrl });
        setPreviewUrl(res.url || "/favicon.ico");
        setUpdatedAt(res.updated_at || null);
        setStatus({ type: "success", message: "Favicon gespeichert. Bitte Browser-Cache leeren/hart neu laden." });
      } catch (err: any) {
        const apiErr = err as ApiError;
        setStatus({ type: "error", message: apiErr.message || "Upload fehlgeschlagen." });
      }
    };
    reader.onerror = () => {
      setStatus({ type: "error", message: "Datei konnte nicht gelesen werden." });
    };
    reader.readAsDataURL(file);
  };

  const onReset = async () => {
    setStatus(null);
    try {
      const res = await resetFavicon();
      setPreviewUrl(res.url || "/favicon.ico");
      setUpdatedAt(res.updated_at || null);
      setStatus({ type: "success", message: "Favicon zurückgesetzt. Bitte hart neu laden." });
    } catch (err: any) {
      const apiErr = err as ApiError;
      setStatus({ type: "error", message: apiErr.message || "Zurücksetzen fehlgeschlagen." });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Branding / Favicon</h2>
        <p className="text-sm text-slate-600">
          Lade ein eigenes Favicon (PNG, ICO, SVG, max. 1MB). Nach Upload bitte einen Hard-Reload im Browser durchführen, damit das neue Icon sichtbar wird.
        </p>
      </div>
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 border border-slate-200 rounded-lg flex items-center justify-center bg-white overflow-hidden">
          {previewUrl ? (
            <img
              src={`${previewUrl}${previewUrl.includes("?") ? "&" : "?"}cb=${updatedAt ? new Date(updatedAt).getTime() : Date.now()}`}
              alt="Favicon Preview"
              className="w-full h-full object-contain"
            />
          ) : (
            <span className="text-xs text-slate-500">kein Icon</span>
          )}
        </div>
        <div className="text-sm text-slate-600">
          {updatedAt ? `Zuletzt aktualisiert: ${new Date(updatedAt).toLocaleString()}` : "Noch kein Upload erfolgt"}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 items-center">
        <label className="btn-secondary cursor-pointer">
          <input
            type="file"
            accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml"
            className="hidden"
            disabled={loading}
            onChange={(e) => handleFileChange(e.target.files?.[0])}
          />
          Neues Favicon hochladen
        </label>
        <button type="button" className="btn-secondary" onClick={onReset} disabled={loading}>
          Auf Standard zurücksetzen
        </button>
      </div>
      {status && <Alert type={status.type === "error" ? "error" : "success"}>{status.message}</Alert>}
    </div>
  );
}

function BackupSettingsPanel() {
  const defaultRetention = { max_count: null as number | null, max_days: null as number | null };
  const defaultNfs = { enabled: false, auto_mount: true, server: "", export_path: "", mount_point: "", options: "" };
  const defaultAuto = {
    enabled: false,
    interval_minutes: 1440,
    target: "local" as "local" | "nas",
    include_db: true,
    include_files: true,
    include_env: false,
    last_run_at: null as string | null,
    next_run_at: null as string | null,
  };

  const [settings, setSettings] = useState<BackupSettings>({
    local_path: "",
    nas_path: "",
    default_target: "local",
    ui_create_target: "local",
    retention: defaultRetention,
    nfs: defaultNfs,
    auto: defaultAuto,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<FormStatus>(null);
  const [pathStatus, setPathStatus] = useState<FormStatus>(null);
  const [nfsStatus, setNfsStatus] = useState<FormStatus>(null);
  const [listStatus, setListStatus] = useState<FormStatus>(null);
  const [backups, setBackups] = useState<BackupSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [createTarget, setCreateTarget] = useState<"local" | "nas">("local");
  const [includeDb, setIncludeDb] = useState(true);
  const [includeFiles, setIncludeFiles] = useState(true);
  const [includeEnv, setIncludeEnv] = useState(true);
  const [busyCreate, setBusyCreate] = useState(false);
  const [restoreDialog, setRestoreDialog] = useState<{ backup: BackupSummary; options: { db: boolean; files: boolean; env: boolean } } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<BackupSummary | null>(null);
  const [busyRestore, setBusyRestore] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);
  const [busyMount, setBusyMount] = useState(false);

  const retention = settings.retention || defaultRetention;
  const nfsCfg = settings.nfs || defaultNfs;
  const autoCfg = settings.auto || defaultAuto;
  const autoHours = Math.max(Math.round(((autoCfg.interval_minutes || 1440) as number) / 60), 1);

  const formatSize = (size?: number | null) => {
    if (!size && size !== 0) return "–";
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const targetLabel = (target: "local" | "nas") => (target === "nas" ? "NAS" : "Server");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const data = await getBackupSettings();
      const defaultTarget = data.default_target === "nas" ? "nas" : "local";
      const uiTarget = data.ui_create_target === "nas" ? "nas" : data.ui_create_target === "local" ? "local" : defaultTarget;
      const nasAvailable = !!(data.nas_path || data.nfs?.mount_point || "").trim();
      const resolvedTarget = uiTarget === "nas" && !nasAvailable ? "local" : uiTarget;
      setSettings({
        local_path: data.local_path || "",
        nas_path: data.nas_path || "",
        default_target: defaultTarget,
        ui_create_target: uiTarget,
        retention: data.retention || defaultRetention,
        nfs: data.nfs || defaultNfs,
        auto: data.auto || { ...defaultAuto, target: defaultTarget },
      });
      setCreateTarget(resolvedTarget);
    } catch (err: any) {
      const apiErr = err as ApiError;
      setStatus({ type: "error", message: apiErr.message || "Backups-Einstellungen konnten nicht geladen werden." });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBackups = useCallback(async () => {
    setListStatus(null);
    setListLoading(true);
    try {
      const list = await listBackups();
      setBackups(list);
    } catch (err: any) {
      const apiErr = err as ApiError;
      setListStatus({ type: "error", message: apiErr.message || "Backups konnten nicht geladen werden." });
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadBackups();
  }, [loadSettings, loadBackups]);

  const onSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const saved = await updateBackupSettings({
        ...settings,
        retention,
        nfs: nfsCfg,
        auto: { ...autoCfg, interval_minutes: autoHours * 60 },
      });
      setSettings(saved);
      const nextTarget = saved.ui_create_target === "nas" ? "nas" : saved.ui_create_target === "local" ? "local" : "local";
      setCreateTarget(nextTarget);
      setStatus({ type: "success", message: "Einstellungen gespeichert." });
    } catch (err: any) {
      const apiErr = err as ApiError;
      setStatus({ type: "error", message: apiErr.message || "Einstellungen konnten nicht gespeichert werden." });
    } finally {
      setSaving(false);
    }
  };

  const onTestPath = async (pathValue: string, label: string) => {
    setPathStatus(null);
    if (!pathValue.trim()) {
      setPathStatus({ type: "error", message: `${label} fehlt.` });
      return;
    }
    try {
      const res = await testBackupPathApi({ path: pathValue });
      setPathStatus({ type: "success", message: `${label} schreibbar: ${res.path}` });
    } catch (err: any) {
      const apiErr = err as ApiError;
      setPathStatus({ type: "error", message: apiErr.message || `${label} konnte nicht geprüft werden.` });
    }
  };

  const onMountNfs = async () => {
    setNfsStatus(null);
    setBusyMount(true);
    try {
      const res = await mountNfsShare();
      if (res.ok) {
        const msg = res.justMounted ? "NFS gemountet und schreibbar." : "NFS bereits verfügbar.";
        setNfsStatus({ type: "success", message: res.message || msg });
        if (res.path && !settings.nas_path) {
          setSettings((s) => ({ ...s, nas_path: s.nas_path || s.nfs?.mount_point || res.path }));
        }
      } else {
        setNfsStatus({ type: "error", message: res.message || "NFS Mount fehlgeschlagen." });
      }
    } catch (err: any) {
      const apiErr = err as ApiError;
      setNfsStatus({ type: "error", message: apiErr.message || "NFS Mount fehlgeschlagen." });
    } finally {
      setBusyMount(false);
    }
  };

  const persistCreateTarget = async (nextTarget: "local" | "nas") => {
    setCreateTarget(nextTarget);
    setSettings((s) => ({ ...s, ui_create_target: nextTarget }));
    try {
      await updateBackupSettings({ ui_create_target: nextTarget });
    } catch (err: any) {
      const apiErr = err as ApiError;
      setListStatus({ type: "error", message: apiErr.message || "Speicherziel konnte nicht gespeichert werden." });
    }
  };

  const onCreateBackup = async () => {
    setBusyCreate(true);
    setListStatus(null);
    try {
      const res = await createBackupApi({
        target: createTarget,
        include_db: includeDb,
        include_files: includeFiles,
        include_env: includeEnv,
      });
      const created = res.backup;
      setBackups((prev) => [created, ...prev.filter((b) => b.filename !== created.filename)]);
      setListStatus({ type: "success", message: "Backup erstellt." });
    } catch (err: any) {
      const apiErr = err as ApiError;
      setListStatus({ type: "error", message: apiErr.message || "Backup konnte nicht erstellt werden." });
    } finally {
      setBusyCreate(false);
    }
  };

  const confirmRestore = (backup: BackupSummary) => {
    setRestoreDialog({ backup, options: { db: true, files: true, env: false } });
  };

  const handleRestore = async () => {
    if (!restoreDialog) return;
    setBusyRestore(true);
    setListStatus(null);
    try {
      await restoreBackupApi({
        name: restoreDialog.backup.filename,
        target: restoreDialog.backup.target,
        restore_db: restoreDialog.options.db,
        restore_files: restoreDialog.options.files,
        restore_env: restoreDialog.options.env,
      });
      setListStatus({ type: "success", message: "Backup wiederhergestellt." });
      setRestoreDialog(null);
    } catch (err: any) {
      const apiErr = err as ApiError;
      setListStatus({ type: "error", message: apiErr.message || "Restore fehlgeschlagen." });
    } finally {
      setBusyRestore(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    setBusyDelete(true);
    setListStatus(null);
    try {
      await deleteBackupApi(deleteDialog.filename, deleteDialog.target);
      setBackups((prev) => prev.filter((b) => b.filename !== deleteDialog.filename));
      setListStatus({ type: "success", message: "Backup gelöscht." });
      setDeleteDialog(null);
    } catch (err: any) {
      const apiErr = err as ApiError;
      setListStatus({ type: "error", message: apiErr.message || "Backup konnte nicht gelöscht werden." });
    } finally {
      setBusyDelete(false);
    }
  };

  const invoicesLink = invoicesArchiveUrl();
  const nasConfigured = (settings.nas_path || nfsCfg.mount_point || "").trim().length > 0;
  const settingsValid = settings.local_path?.trim().length > 0;
  const canCreate = createTarget === "local" || (createTarget === "nas" && nasConfigured);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Backups</h2>
        <p className="text-sm text-slate-600">
          Sichere Datenbank, PDFs (inkl. Archiv/Trash) und Konfiguration (.env). Archive werden als ZIP erstellt, damit sie ohne Zusatztools entpackt werden können.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-4">
          <h3 className="font-semibold text-slate-800">Speicherziele &amp; NFS</h3>
          <form className="space-y-3" onSubmit={onSaveSettings}>
            <label className="block text-sm text-slate-700">
              <span className="font-medium">Lokaler Pfad</span>
              <input
                className="input mt-1"
                value={settings.local_path || ""}
                onChange={(e) => setSettings((s) => ({ ...s, local_path: e.target.value }))}
                disabled={loading}
                required
              />
            </label>
            <label className="block text-sm text-slate-700">
              <span className="font-medium">NAS Pfad (optional)</span>
              <input
                className="input mt-1"
                value={settings.nas_path || ""}
                onChange={(e) => setSettings((s) => ({ ...s, nas_path: e.target.value }))}
                disabled={loading}
                placeholder="/mnt/nas/backups"
              />
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="defaultTarget"
                  value="local"
                  checked={settings.default_target !== "nas"}
                  onChange={() => setSettings((s) => ({ ...s, default_target: "local" }))}
                  disabled={loading}
                />
                Standard: Lokaler Pfad
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="defaultTarget"
                  value="nas"
                  checked={settings.default_target === "nas"}
                  onChange={() => setSettings((s) => ({ ...s, default_target: "nas" }))}
                  disabled={loading}
                />
                Standard: NAS (falls gesetzt)
              </label>
            </div>

            <div className="border border-slate-200 rounded-lg p-3 bg-white space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-slate-800 text-sm">NFS Mount</h4>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={!!nfsCfg.enabled}
                      onChange={(e) => setSettings((s) => ({ ...s, nfs: { ...(s.nfs || defaultNfs), enabled: e.target.checked } }))}
                    />
                    Aktivieren
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={nfsCfg.auto_mount !== false}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, nfs: { ...(s.nfs || defaultNfs), auto_mount: e.target.checked } }))
                      }
                    />
                    Auto-Mount
                  </label>
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2 text-sm">
                <label className="block">
                  <span className="font-medium">Server</span>
                  <input
                    className="input mt-1"
                    value={nfsCfg.server || ""}
                    onChange={(e) => setSettings((s) => ({ ...s, nfs: { ...(s.nfs || defaultNfs), server: e.target.value } }))}
                    disabled={loading}
                    placeholder="10.0.0.10"
                  />
                </label>
                <label className="block">
                  <span className="font-medium">Share/Export</span>
                  <input
                    className="input mt-1"
                    value={nfsCfg.export_path || ""}
                    onChange={(e) => setSettings((s) => ({ ...s, nfs: { ...(s.nfs || defaultNfs), export_path: e.target.value } }))}
                    disabled={loading}
                    placeholder="/export/backups"
                  />
                </label>
                <label className="block">
                  <span className="font-medium">Mountpunkt</span>
                  <input
                    className="input mt-1"
                    value={nfsCfg.mount_point || ""}
                    onChange={(e) => setSettings((s) => ({ ...s, nfs: { ...(s.nfs || defaultNfs), mount_point: e.target.value } }))}
                    disabled={loading}
                    placeholder="/mnt/nfs"
                  />
                </label>
                <label className="block">
                  <span className="font-medium">Mount Optionen (optional)</span>
                  <input
                    className="input mt-1"
                    value={nfsCfg.options || ""}
                    onChange={(e) => setSettings((s) => ({ ...s, nfs: { ...(s.nfs || defaultNfs), options: e.target.value } }))}
                    disabled={loading}
                    placeholder="rw,vers=4.1"
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-secondary" type="button" onClick={() => onTestPath(settings.local_path, "Lokaler Pfad")} disabled={loading}>
                  Pfad testen
                </button>
                {nasConfigured && (
                  <button className="btn-secondary" type="button" onClick={() => onTestPath(settings.nas_path || nfsCfg.mount_point || "", "NAS Pfad")} disabled={loading}>
                    NAS testen
                  </button>
                )}
                <button className="btn-secondary" type="button" onClick={onMountNfs} disabled={busyMount || !nfsCfg.enabled}>
                  {busyMount ? "Mounten..." : "NFS mounten/prüfen"}
                </button>
              </div>
              {nfsStatus && <Alert type={nfsStatus.type === "error" ? "error" : "success"}>{nfsStatus.message}</Alert>}
            </div>

            <div className="border border-slate-200 rounded-lg p-3 bg-white space-y-2">
              <h4 className="font-semibold text-slate-800 text-sm">Retention</h4>
              <div className="grid gap-2 md:grid-cols-2 text-sm">
                <label className="block">
                  <span className="font-medium">Max. Anzahl Backups</span>
                  <input
                    className="input mt-1"
                    type="number"
                    min={1}
                    value={retention.max_count ?? ""}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        retention: { ...(s.retention || defaultRetention), max_count: e.target.value ? Number(e.target.value) : null },
                      }))
                    }
                  />
                </label>
                <label className="block">
                  <span className="font-medium">Max. Alter (Tage)</span>
                  <input
                    className="input mt-1"
                    type="number"
                    min={1}
                    value={retention.max_days ?? ""}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        retention: { ...(s.retention || defaultRetention), max_days: e.target.value ? Number(e.target.value) : null },
                      }))
                    }
                  />
                </label>
              </div>
              <p className="text-xs text-slate-600">Ältere Backups werden nach neuen Sicherungen automatisch gelöscht.</p>
            </div>

            <div className="border border-slate-200 rounded-lg p-3 bg-white space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-slate-800 text-sm">Auto-Backups</h4>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={!!autoCfg.enabled}
                    onChange={(e) => setSettings((s) => ({ ...s, auto: { ...(s.auto || defaultAuto), enabled: e.target.checked } }))}
                  />
                  Aktivieren
                </label>
              </div>
              <div className="grid gap-2 md:grid-cols-2 text-sm">
                <label className="block">
                  <span className="font-medium">Intervall (Stunden)</span>
                  <input
                    className="input mt-1"
                    type="number"
                    min={1}
                    value={autoHours}
                    onChange={(e) => {
                      const hours = Math.max(Number(e.target.value) || 1, 1);
                      setSettings((s) => ({ ...s, auto: { ...(s.auto || defaultAuto), interval_minutes: hours * 60 } }));
                    }}
                  />
                </label>
                <label className="block">
                  <span className="font-medium">Ziel</span>
                  <select
                    className="input mt-1"
                    value={autoCfg.target === "nas" ? "nas" : "local"}
                    onChange={(e) => setSettings((s) => ({ ...s, auto: { ...(s.auto || defaultAuto), target: e.target.value === "nas" ? "nas" : "local" } }))}
                  >
                    <option value="local">Server</option>
                    <option value="nas" disabled={!nasConfigured}>
                      NAS
                    </option>
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!autoCfg.include_db}
                    onChange={(e) => setSettings((s) => ({ ...s, auto: { ...(s.auto || defaultAuto), include_db: e.target.checked } }))}
                  />
                  Datenbank
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!autoCfg.include_files}
                    onChange={(e) => setSettings((s) => ({ ...s, auto: { ...(s.auto || defaultAuto), include_files: e.target.checked } }))}
                  />
                  PDFs &amp; Branding
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!autoCfg.include_env}
                    onChange={(e) => setSettings((s) => ({ ...s, auto: { ...(s.auto || defaultAuto), include_env: e.target.checked } }))}
                  />
                  .env Dateien
                </label>
              </div>
              <div className="text-xs text-slate-600 space-y-1">
                <div>Letzter Lauf: {autoCfg.last_run_at ? new Date(autoCfg.last_run_at).toLocaleString() : "–"}</div>
                <div>Nächster Lauf: {autoCfg.next_run_at ? new Date(autoCfg.next_run_at).toLocaleString() : "– (nach Speichern neu berechnet)"}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" type="submit" disabled={saving || loading || !settingsValid}>
                {saving ? "Speichere ..." : "Speichern"}
              </button>
              <button
                className="btn-ghost"
                type="button"
                onClick={() => {
                  loadSettings();
                  loadBackups();
                }}
              >
                Neu laden
              </button>
            </div>
            {status && <Alert type={status.type === "error" ? "error" : "success"}>{status.message}</Alert>}
            {pathStatus && <Alert type={pathStatus.type === "error" ? "error" : "success"}>{pathStatus.message}</Alert>}
          </form>
        </div>

        <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-3">
          <h3 className="font-semibold text-slate-800">Backup erstellen</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="createTarget"
                value="local"
                checked={createTarget === "local"}
                onChange={() => {
                  persistCreateTarget("local");
                }}
              />
              Auf Server speichern
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="createTarget"
                value="nas"
                checked={createTarget === "nas"}
                onChange={() => {
                  persistCreateTarget("nas");
                }}
                disabled={!nasConfigured}
              />
              Auf NAS speichern
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={includeDb} onChange={(e) => setIncludeDb(e.target.checked)} />
              Datenbank
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={includeFiles} onChange={(e) => setIncludeFiles(e.target.checked)} />
              PDFs &amp; Branding
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={includeEnv} onChange={(e) => setIncludeEnv(e.target.checked)} />
              .env Dateien
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onCreateBackup} disabled={busyCreate || !canCreate}>
              {busyCreate ? "Sichert ..." : "Backup erstellen"}
            </Button>
            <Button variant="secondary" onClick={() => window.open(invoicesLink, "_blank")}>
              Rechnungen (ZIP) herunterladen
            </Button>
          </div>
          <p className="text-xs text-slate-600">
            Hinweis: Restore überschreibt Daten. Standardmäßig werden .env nicht automatisch zurückgespielt, aktiviere das beim Restore falls benötigt.
          </p>
          {listStatus && <Alert type={listStatus.type === "error" ? "error" : "success"}>{listStatus.message}</Alert>}
        </div>
      </div>

      <div className="border border-slate-200 rounded-lg p-4 bg-white">
        <div className="flex items-center justify-between mb-3 gap-3">
          <div>
            <h3 className="font-semibold text-slate-800">Verfügbare Backups</h3>
            <p className="text-sm text-slate-600">Neueste zuerst. Aktionen nur für Admins möglich.</p>
          </div>
          <Button variant="secondary" onClick={loadBackups} disabled={listLoading}>
            {listLoading ? "Lädt ..." : "Aktualisieren"}
          </Button>
        </div>
        {listLoading && (
          <div className="flex items-center gap-2 text-slate-600">
            <Spinner /> Lade Backups ...
          </div>
        )}
        {!listLoading && backups.length === 0 && (
          <EmptyState title="Keine Backups gefunden" description="Lege ein erstes Backup an." />
        )}
        {!listLoading && backups.length > 0 && (
          <div className="overflow-x-auto overflow-y-visible">
            <table className="w-full text-sm border border-slate-200 rounded-lg overflow-visible">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="text-left px-3 py-2">Datei</th>
                  <th className="text-left px-3 py-2">Ort</th>
                  <th className="text-left px-3 py-2">Erstellt</th>
                  <th className="text-left px-3 py-2">Größe</th>
                  <th className="text-left px-3 py-2">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={`${b.target}-${b.filename}`} className="border-t border-slate-200">
                    <td className="px-3 py-2">
                      <div className="font-semibold text-slate-900 break-all">{b.filename}</div>
                      <div className="text-xs text-slate-600">
                        {(b.includes?.db ? "DB" : "")} {b.includes?.files ? "• Files" : ""} {b.includes?.env ? "• env" : ""}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{targetLabel(b.target)}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {b.created_at ? new Date(b.created_at).toLocaleString() : "–"}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{formatSize(b.size)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <a
                          className="btn-secondary text-xs"
                          href={backupDownloadUrl(b.filename, b.target)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Download
                        </a>
                        <Button variant="secondary" onClick={() => confirmRestore(b)}>
                          Restore
                        </Button>
                        <Button variant="ghost" onClick={() => setDeleteDialog(b)}>
                          Löschen
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {restoreDialog && (
        <Modal title={`Backup wiederherstellen (${restoreDialog.backup.filename})`} onClose={() => setRestoreDialog(null)}>
          <div className="space-y-3 text-sm">
            <p className="text-slate-700">
              Restore überschreibt bestehende Daten. Stelle sicher, dass keine Nutzer aktiv arbeiten. .env wird nur wiederhergestellt, wenn gewählt.
            </p>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={restoreDialog.options.db}
                onChange={(e) => setRestoreDialog((d) => d ? { ...d, options: { ...d.options, db: e.target.checked } } : null)}
              />
              Datenbank wiederherstellen
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={restoreDialog.options.files}
                onChange={(e) => setRestoreDialog((d) => d ? { ...d, options: { ...d.options, files: e.target.checked } } : null)}
              />
              PDFs/Branding wiederherstellen
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={restoreDialog.options.env}
                onChange={(e) => setRestoreDialog((d) => d ? { ...d, options: { ...d.options, env: e.target.checked } } : null)}
              />
              .env Dateien überschreiben
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setRestoreDialog(null)} disabled={busyRestore}>
                Abbrechen
              </Button>
              <Button onClick={handleRestore} disabled={busyRestore}>
                {busyRestore ? "Stellt wieder her ..." : "Restore ausführen"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {deleteDialog && (
        <Confirm
          title="Backup löschen?"
          description={`Backup ${deleteDialog.filename} (${targetLabel(deleteDialog.target)}) entfernen?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteDialog(null)}
          busy={busyDelete}
        />
      )}
    </div>
  );
}

function NetworkSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [status, setStatus] = useState<FormStatus>(null);
  const [diagStatus, setDiagStatus] = useState<FormStatus>(null);
  const [diagResult, setDiagResult] = useState<any>(null);
  const [originsText, setOriginsText] = useState("https://rechnung.intern\nhttp://rechnung.intern");
  const [trustProxy, setTrustProxy] = useState(true);
  const [bindHost, setBindHost] = useState("0.0.0.0");
  const [publicPort, setPublicPort] = useState("3031");
  const [publicUrl, setPublicUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setStatus(null);
    getNetworkSettings()
      .then((data) => {
        setOriginsText((data.cors_origins || []).join("\n"));
        setTrustProxy(Boolean(data.trust_proxy));
        if ((data as any).bind_host) setBindHost(String((data as any).bind_host));
        if ((data as any).public_port) setPublicPort(String((data as any).public_port));
        if ((data as any).public_url) setPublicUrl(String((data as any).public_url));
      })
      .catch((err: ApiError) => setStatus({ type: "error", message: err.message || "Netzwerk-Einstellungen konnten nicht geladen werden." }))
      .finally(() => setLoading(false));
  }, []);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const origins = originsText
        .split(/\n/)
        .map((o) => o.trim())
        .filter(Boolean);
      const payload: any = { cors_origins: origins, trust_proxy: trustProxy };
      const saved = await updateNetworkSettings(payload);
      setOriginsText((saved.cors_origins || []).join("\n"));
      setTrustProxy(Boolean(saved.trust_proxy));
      if ((saved as any).bind_host) setBindHost(String((saved as any).bind_host));
      if ((saved as any).public_port) setPublicPort(String((saved as any).public_port));
      if ((saved as any).public_url) setPublicUrl(String((saved as any).public_url));
      setStatus({ type: "success", message: saved.message || "Netzwerk-Einstellungen gespeichert." });
    } catch (err: any) {
      const apiErr = err as ApiError;
      setStatus({ type: "error", message: apiErr.message || "Speichern fehlgeschlagen." });
    } finally {
      setSaving(false);
    }
  };

  const runDiagnostics = async () => {
    setDiagnosing(true);
    setDiagStatus(null);
    setDiagResult(null);
    try {
      const res = await getNetworkDiagnostics();
      setDiagResult(res);
      setDiagStatus({ type: "success", message: "Diagnose ausgeführt." });
    } catch (err: any) {
      const apiErr = err as ApiError;
      setDiagStatus({ type: "error", message: apiErr.message || "Diagnose fehlgeschlagen." });
    } finally {
      setDiagnosing(false);
    }
  };

  const publicPortValue = publicPort.trim() || "3031";
  const hostValue = bindHost.trim();
  const publicUrlValue = publicUrl.trim();
  const hostValid = !hostValue || /^(([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+|((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\.(?!$)|$)){4})$/.test(hostValue);
  const portValid = /^\d+$/.test(publicPortValue) && Number(publicPortValue) >= 1 && Number(publicPortValue) <= 65535;
  const publicUrlValid = !publicUrlValue || /^https?:\/\/[^\/]+$/i.test(publicUrlValue);
  const originsValid = originsText
    .split(/\n/)
    .map((o) => o.trim())
    .filter(Boolean)
    .every((o) => /^https?:\/\/[^\/]+$/i.test(o));
  const formValid = originsValid && hostValid && portValid && publicUrlValid;
  const reachabilityUrl = publicUrlValue || `http://${hostValue || "127.0.0.1"}:${publicPortValue || "3031"}`;

  const InfoButton = ({ text }: { text: string }) => (
    <button
      type="button"
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-xs text-slate-500 hover:bg-slate-100"
      title={text}
      aria-label={text}
    >
      i
    </button>
  );

  const copyReachabilityUrl = async () => {
    try {
      await navigator.clipboard.writeText(reachabilityUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.warn("Copy failed", err);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Netzwerk / Proxy</h2>
        <p className="text-sm text-slate-600">
          CORS-Origins und Trust-Proxy steuern den Betrieb hinter NPM/Reverse Proxy. Änderungen werden sofort wirksam, Trust Proxy wird live gesetzt.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <Button variant="secondary" type="button" onClick={runDiagnostics} disabled={diagnosing || loading}>
          {diagnosing ? "Diagnose..." : "Diagnose starten"}
        </Button>
        <Button variant="secondary" type="button" onClick={copyReachabilityUrl} disabled={copied}>
          {copied ? "Kopiert" : "URL kopieren"}
        </Button>
        <Button
          variant="ghost"
          type="button"
          onClick={() => {
            setOriginsText("");
            setTrustProxy(true);
            setStatus(null);
          }}
        >
          Auf Standard setzen
        </Button>
      </div>
      <form className="space-y-3" onSubmit={onSave}>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-700 block">
            <span className="font-medium flex items-center gap-2">
              Bind-Adresse (IP oder Host)
              <InfoButton text="Legt fest, auf welcher IP der Server lauscht. Wird aus .env/Docker gelesen und nur beim Start angewendet." />
            </span>
            <span className="text-xs text-slate-500 block">(z.B. 127.0.0.1 nur lokal, 0.0.0.0 im Netzwerk)</span>
            <input
              type="text"
              className="input mt-1"
              value={bindHost}
              placeholder="0.0.0.0"
              onChange={(e) => setBindHost(e.target.value)}
              disabled={loading}
              readOnly
            />
            {!hostValid && <p className="text-xs text-red-600 mt-1">Bitte eine gültige IP oder einen Hostnamen ohne Protokoll angeben.</p>}
          </label>
          <label className="text-sm text-slate-700 block">
            <span className="font-medium flex items-center gap-2">
              Öffentlicher Port
              <InfoButton text="Anzeige-Port für Erreichbarkeit. Der echte Listen-Port kommt aus APP_PORT/APP_HTTPS_PORT. Änderung nur per .env/Neustart." />
            </span>
            <span className="text-xs text-slate-500 block">(1–65535, Standard 3031)</span>
            <input
              type="text"
              className="input mt-1"
              value={publicPort}
              onChange={(e) => setPublicPort(e.target.value)}
              disabled={loading}
              inputMode="numeric"
              pattern="[0-9]*"
              readOnly
            />
            {!portValid && <p className="text-xs text-red-600 mt-1">Port muss zwischen 1 und 65535 liegen.</p>}
          </label>
          <label className="text-sm text-slate-700 block">
            <span className="font-medium flex items-center gap-2">
              Öffentliche URL (optional)
              <InfoButton text="Öffentliche Basis-URL für Anzeige/Links. Wird aus APP_PUBLIC_URL/APP_DOMAIN gelesen. Änderung nur per .env/Neustart." />
            </span>
            <span className="text-xs text-slate-500 block">z.B. https://rechnung.intern</span>
            <input
              type="text"
              className="input mt-1"
              value={publicUrl}
              onChange={(e) => setPublicUrl(e.target.value)}
              disabled={loading}
              placeholder="https://rechnung.intern"
              readOnly
            />
            {!publicUrlValid && <p className="text-xs text-red-600 mt-1">Bitte eine gültige http/https URL ohne Pfad angeben.</p>}
          </label>
          <div className="md:col-span-2 text-xs text-slate-500">
            Hinweis: Bind-Adresse, Port und öffentliche URL werden aus der Umgebung (.env/Docker) gelesen und
            erfordern einen Neustart. Änderungen bitte im Wizard oder per .env/Compose vornehmen.
          </div>
          <div className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between">
            <div>
              <div className="font-medium text-slate-800">Erreichbar unter</div>
              <div className="text-slate-600 text-xs break-all">{reachabilityUrl}</div>
            </div>
            <button type="button" className="btn-secondary text-xs" onClick={copyReachabilityUrl}>
              {copied ? "Kopiert" : "Kopieren"}
            </button>
          </div>
        </div>
        <label className="text-sm text-slate-700 block">
          <span className="font-medium flex items-center gap-2">
            CORS Origins (eine pro Zeile)
            <InfoButton text="Erlaubte Browser-Ursprünge für API-Zugriff. Eine URL pro Zeile, nur http/https ohne Pfad." />
          </span>
          <textarea
            className="textarea mt-1"
            rows={4}
            value={originsText}
            onChange={(e) => setOriginsText(e.target.value)}
            disabled={loading}
          />
          {!originsValid && <p className="text-xs text-red-600 mt-1">Nur http/https Origins ohne Pfad erlaubt.</p>}
        </label>
        <div className="flex items-center gap-2 text-sm text-slate-700">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={trustProxy}
              onChange={(e) => setTrustProxy(e.target.checked)}
              disabled={loading}
            />
            Trust Proxy aktivieren (empfohlen hinter NPM)
          </label>
          <InfoButton text="Aktivieren, wenn ein Reverse Proxy davorsteht (z.B. NPM). Nutzt X-Forwarded-* für IP/HTTPS-Erkennung." />
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" type="submit" disabled={saving || loading || !formValid}>
            {saving ? "Speichere ..." : "Speichern"}
          </button>
          <button className="btn-secondary" type="button" onClick={runDiagnostics} disabled={diagnosing || loading}>
            {diagnosing ? "Prüfe ..." : "Diagnose ausführen"}
          </button>
        </div>
      </form>
      {status && <Alert type={status.type === "error" ? "error" : "success"}>{status.message}</Alert>}
      {diagStatus && <Alert type={diagStatus.type === "error" ? "error" : "success"}>{diagStatus.message}</Alert>}
      {diagResult && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1 text-sm text-slate-700">
          <div>API: {diagResult.api ? "ok" : "fail"}</div>
          <div>DB: {diagResult.db ? "ok" : "fail"}</div>
          <div>PDF Pfad schreibbar: {diagResult.pdf_path_writable ? "ok" : "fail"}</div>
          <div>SMTP konfiguriert: {diagResult.smtp_config_present ? "ja" : "nein"}</div>
          <div>CORS aktiv: {(diagResult.cors_effective || []).join(", ") || "–"}</div>
          <div>Trust Proxy aktiv: {diagResult.trust_proxy_effective ? "ja" : "nein"}</div>
        </div>
      )}
    </div>
  );
}

function SecuritySettingsInfo() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<FormStatus>(null);
  const [certPem, setCertPem] = useState("");
  const [certStatus, setCertStatus] = useState<FormStatus>(null);
  const [mfaStatus, setMfaStatus] = useState<{ enabled: boolean; pending: boolean } | null>(null);
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; otpauth_url: string; qr_code: string } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaDisableCode, setMfaDisableCode] = useState("");
  const [mfaDisablePassword, setMfaDisablePassword] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaStatusMsg, setMfaStatusMsg] = useState<FormStatus>(null);

  useEffect(() => {
    setMfaStatusMsg(null);
    getMfaStatus()
      .then((data) => setMfaStatus(data))
      .catch((err: ApiError) => setMfaStatusMsg({ type: "error", message: err.message || "MFA Status konnte nicht geladen werden." }));
  }, []);

  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setStatus({ type: "error", message: "Bitte alle Felder ausfüllen." });
      return;
    }
    if (newPassword.length < 8) {
      setStatus({ type: "error", message: "Neues Passwort muss mindestens 8 Zeichen haben." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus({ type: "error", message: "Neue Passwörter stimmen nicht überein." });
      return;
    }
    setSaving(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setStatus({ type: "success", message: "Passwort aktualisiert." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      const apiErr = err as ApiError;
      setStatus({ type: "error", message: apiErr.message || "Passwort konnte nicht geändert werden." });
    } finally {
      setSaving(false);
    }
  };

  const onUploadCert = async (e: React.FormEvent) => {
    e.preventDefault();
    setCertStatus(null);
    if (!certPem.trim()) {
      setCertStatus({ type: "error", message: "PEM-Inhalt einfügen." });
      return;
    }
    try {
      await uploadCaCertificate({ pem: certPem.trim() });
      setCertStatus({ type: "success", message: "Zertifikat gespeichert." });
      setCertPem("");
    } catch (err: any) {
      const apiErr = err as ApiError;
      setCertStatus({ type: "error", message: apiErr.message || "Zertifikat konnte nicht gespeichert werden." });
    }
  };

  const beginMfaSetup = async () => {
    setMfaBusy(true);
    setMfaStatusMsg(null);
    try {
      const data = await startMfaSetup();
      setMfaSetup(data);
      setMfaCode("");
      setMfaStatus((prev) => ({ enabled: false, pending: true }));
    } catch (err: any) {
      const apiErr = err as ApiError;
      setMfaStatusMsg({ type: "error", message: apiErr.message || "MFA Setup fehlgeschlagen." });
    } finally {
      setMfaBusy(false);
    }
  };

  const confirmMfaSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaCode.trim()) {
      setMfaStatusMsg({ type: "error", message: "MFA Code fehlt." });
      return;
    }
    setMfaBusy(true);
    setMfaStatusMsg(null);
    try {
      await verifyMfaSetup(mfaCode.trim());
      setMfaSetup(null);
      setMfaCode("");
      setMfaStatus({ enabled: true, pending: false });
      setMfaStatusMsg({ type: "success", message: "MFA aktiviert." });
    } catch (err: any) {
      const apiErr = err as ApiError;
      setMfaStatusMsg({ type: "error", message: apiErr.message || "MFA Aktivierung fehlgeschlagen." });
    } finally {
      setMfaBusy(false);
    }
  };

  const handleMfaDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaDisablePassword.trim()) {
      setMfaStatusMsg({ type: "error", message: "Passwort erforderlich." });
      return;
    }
    if (mfaStatus?.enabled && !mfaDisableCode.trim()) {
      setMfaStatusMsg({ type: "error", message: "MFA Code erforderlich." });
      return;
    }
    setMfaBusy(true);
    setMfaStatusMsg(null);
    try {
      await disableMfa({ password: mfaDisablePassword.trim(), code: mfaDisableCode.trim() || undefined });
      setMfaStatus({ enabled: false, pending: false });
      setMfaDisablePassword("");
      setMfaDisableCode("");
      setMfaSetup(null);
      setMfaStatusMsg({ type: "success", message: "MFA deaktiviert." });
    } catch (err: any) {
      const apiErr = err as ApiError;
      setMfaStatusMsg({ type: "error", message: apiErr.message || "MFA konnte nicht deaktiviert werden." });
    } finally {
      setMfaBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Sicherheit</h2>
        <ul className="text-sm text-slate-700 list-disc pl-4 space-y-1">
          <li>Rate Limits aktivierbar per RATE_LIMIT_ENABLED (Login-Limit strenger).</li>
          <li>Cookies: HttpOnly, SameSite=Lax, Secure automatisch bei HTTPS (NPM).</li>
          <li>API Keys (X-API-Key) in eigenem Tab verwalten.</li>
        </ul>
      </div>

      <div className="border border-slate-200 rounded-lg p-4 space-y-3">
        <div>
          <h3 className="text-md font-semibold text-slate-800">Passwort ändern</h3>
          <p className="text-sm text-slate-600">Aktuelles Passwort bestätigen und ein neues festlegen.</p>
        </div>
        {status && <Alert type={status.type === "error" ? "error" : "success"}>{status.message}</Alert>}
        <form className="grid gap-3 md:grid-cols-2" onSubmit={onChangePassword}>
          <Field label="Aktuelles Passwort" className="md:col-span-2">
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </Field>
          <Field label="Neues Passwort">
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
            />
          </Field>
          <Field label="Neues Passwort bestätigen">
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
            />
          </Field>
          <div className="md:col-span-2 flex items-center gap-2">
            <Button type="submit" disabled={saving} variant="primary">
              {saving ? "Speichern ..." : "Passwort aktualisieren"}
            </Button>
          </div>
        </form>
      </div>

      <div className="border border-slate-200 rounded-lg p-4 space-y-3">
        <div>
          <h3 className="text-md font-semibold text-slate-800">Multi-Faktor-Login (TOTP)</h3>
          <p className="text-sm text-slate-600">Authenticator-App (z.B. Google Authenticator, 1Password) nutzen.</p>
        </div>
        <div className="text-sm text-slate-700">
          Status: {mfaStatus?.enabled ? "aktiv" : "nicht aktiv"}{mfaStatus?.pending && !mfaStatus?.enabled ? " (Setup läuft)" : ""}
        </div>
        {mfaStatusMsg && <Alert type={mfaStatusMsg.type === "error" ? "error" : "success"}>{mfaStatusMsg.message}</Alert>}

        {!mfaStatus?.enabled && (
          <div className="space-y-3">
            <Button type="button" variant="secondary" onClick={beginMfaSetup} disabled={mfaBusy}>
              {mfaBusy ? "Starte..." : "MFA einrichten"}
            </Button>
            {mfaSetup ? (
              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <div className="text-xs text-slate-500">QR-Code scannen</div>
                  <div className="w-44 h-44 border border-slate-200 rounded-lg bg-white flex items-center justify-center">
                    <img src={mfaSetup.qr_code} alt="MFA QR Code" className="w-40 h-40" />
                  </div>
                  <div className="text-xs text-slate-500">Secret (manuell)</div>
                  <code className="block text-xs bg-slate-100 border border-slate-200 rounded px-2 py-1 break-all">
                    {mfaSetup.secret}
                  </code>
                </div>
                <form className="space-y-2" onSubmit={confirmMfaSetup}>
                  <Field label="MFA Code">
                    <Input
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value)}
                      inputMode="numeric"
                      placeholder="6-stelliger Code"
                    />
                  </Field>
                  <Button type="submit" disabled={mfaBusy}>
                    {mfaBusy ? "Prüfe..." : "MFA aktivieren"}
                  </Button>
                </form>
              </div>
            ) : (
              mfaStatus?.pending && (
                <div className="text-xs text-slate-500">Setup wurde gestartet. Bitte erneut „MFA einrichten“ klicken, falls du neu beginnen möchtest.</div>
              )
            )}
          </div>
        )}

        {mfaStatus?.enabled && (
          <form className="grid gap-3 md:grid-cols-2" onSubmit={handleMfaDisable}>
            <Field label="Passwort">
              <Input
                type="password"
                value={mfaDisablePassword}
                onChange={(e) => setMfaDisablePassword(e.target.value)}
                required
              />
            </Field>
            <Field label="MFA Code">
              <Input
                value={mfaDisableCode}
                onChange={(e) => setMfaDisableCode(e.target.value)}
                inputMode="numeric"
                placeholder="6-stelliger Code"
                required
              />
            </Field>
            <div className="md:col-span-2 flex items-center gap-2">
              <Button type="submit" variant="danger" disabled={mfaBusy}>
                {mfaBusy ? "Deaktiviere..." : "MFA deaktivieren"}
              </Button>
            </div>
          </form>
        )}
      </div>

      <div className="border border-slate-200 rounded-lg p-4 space-y-3">
        <div>
          <h3 className="text-md font-semibold text-slate-800">Zertifikate</h3>
          <p className="text-sm text-slate-600">CA-Zertifikat hinterlegen oder herunterladen.</p>
        </div>
        {certStatus && <Alert type={certStatus.type === "error" ? "error" : "success"}>{certStatus.message}</Alert>}
        <form className="space-y-3" onSubmit={onUploadCert}>
          <Field label="PEM-Inhalt">
            <Textarea
              value={certPem}
              onChange={(e) => setCertPem(e.target.value)}
              placeholder="-----BEGIN CERTIFICATE-----"
              className="min-h-[140px]"
            />
          </Field>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="primary" disabled={!certPem.trim()}>
              Speichern
            </Button>
            <Button type="button" variant="secondary" onClick={() => window.open("/api/settings/ca-cert", "_blank")}>
              Zertifikat herunterladen
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SmtpSettingsForm() {
  const { refresh } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<FormStatus>(null);
  const [form, setForm] = useState({
    host: "",
    port: "",
    secure: false,
    user: "",
    password: "",
    from: "",
    reply_to: "",
    has_password: false,
  });
  const [testRecipient, setTestRecipient] = useState("");
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [testResult, setTestResult] = useState<FormStatus>(null);

  useEffect(() => {
    setStatus(null);
    setLoading(true);
    getSmtpSettings()
      .then((data) => {
        setForm({
          host: data.host || "",
      port: data.port ? String(data.port) : "",
      secure: Boolean(data.secure),
      user: data.user || "",
      password: "",
      from: data.from || "",
      reply_to: data.reply_to || "",
      has_password: Boolean((data as any).has_password),
    });
        setShowPasswordInput(false);
    })
    .catch((err: ApiError) => {
      setStatus({ type: "error", message: err.message || "Konnte SMTP-Einstellungen nicht laden." });
    })
    .finally(() => setLoading(false));
  }, []);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
      setSaving(true);
      setStatus(null);
      setTestResult(null);
    try {
      const payload: any = {
        host: form.host || null,
        port: form.port ? Number(form.port) : null,
        secure: form.secure,
        user: form.user || null,
        from: form.from || null,
        reply_to: form.reply_to || null,
      };
      if (form.password.trim()) {
        payload.password = form.password;
      }
      const saved = await updateSmtpSettings(payload);
      setForm((prev) => ({
        ...prev,
        has_password: Boolean(saved.has_password),
        password: "",
      }));
      setStatus({ type: "success", message: "SMTP-Einstellungen gespeichert." });
      setShowPasswordInput(false);
      await refresh();
    } catch (err: any) {
      const apiErr = err as ApiError;
      let msg = apiErr.message || "Speichern fehlgeschlagen.";
      if (apiErr.status === 401 || apiErr.status === 403) msg = "Keine Berechtigung.";
      else if (apiErr.status === 400) msg = "Ungültige SMTP Daten.";
      setStatus({ type: "error", message: msg });
    } finally {
      setSaving(false);
    }
  };

  const onTest = async () => {
    if (!testRecipient.trim()) {
      setTestResult({ type: "error", message: "Bitte Empfänger für Testmail angeben." });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testSmtp(testRecipient.trim());
      const msg = res.message || (res.dry_run ? "Dry-Run erfolgreich." : "Testmail gesendet.");
      setTestResult({
        type: res.dry_run ? "info" : "success",
        message: `${msg} Empfänger: ${res.to}${res.redirected ? " (redirected)" : ""}${
          res.dry_run ? " | Versand deaktiviert (EMAIL_SEND_DISABLED=1)" : ""
        }`,
      });
    } catch (err: any) {
      const apiErr = err as ApiError;
      let msg = apiErr.message || "Test fehlgeschlagen.";
      if (apiErr.status === 401 || apiErr.status === 403) msg = "Keine Berechtigung.";
      else if (apiErr.status === 400) msg = "Ungültige SMTP Daten.";
      setTestResult({ type: "error", message: msg });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">SMTP Einstellungen</h2>
        {loading && <span className="text-sm text-slate-500">Lade ...</span>}
      </div>
      <form className="grid gap-4 md:grid-cols-2" onSubmit={onSave}>
        <Field label="Host">
          <input
            value={form.host}
            onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
            className="input"
            required={false}
          />
        </Field>
        <Field label="Port">
          <input
            value={form.port}
            onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
            className="input"
            inputMode="numeric"
          />
        </Field>
        <Field label="Secure (TLS)">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.secure}
              onChange={(e) => setForm((f) => ({ ...f, secure: e.target.checked }))}
            />
            <span>SMTPS (Port 465) nutzen</span>
          </label>
        </Field>
        <div className="hidden md:block" />
        <Field label="Benutzer">
          <input
            value={form.user}
            onChange={(e) => setForm((f) => ({ ...f, user: e.target.value }))}
            className="input"
          />
        </Field>
        <div className="md:col-span-2 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-700 font-medium">Passwort</span>
            {form.has_password ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-200">
                gesetzt
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                nicht gesetzt
              </span>
            )}
            <Button
              variant="secondary"
              type="button"
              onClick={() => setShowPasswordInput((v) => !v)}
            >
              {showPasswordInput ? "Abbrechen" : "Passwort ändern"}
            </Button>
          </div>
          {showPasswordInput && (
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="input"
              placeholder="Neues Passwort eingeben"
            />
          )}
          <p className="text-xs text-slate-500">
            Passwort wird nur gesendet, wenn du es hier eingibst. Nach dem Speichern wird das Feld geleert.
          </p>
        </div>
        <Field label="FROM">
          <input
            value={form.from}
            onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))}
            className="input"
            placeholder="Name <mail@example.com>"
          />
        </Field>
        <Field label="Reply-To (optional)">
          <input
            value={form.reply_to}
            onChange={(e) => setForm((f) => ({ ...f, reply_to: e.target.value }))}
            className="input"
          />
        </Field>
        <div className="md:col-span-2 flex flex-wrap gap-3 items-center mt-2">
          <button
            type="submit"
            className="btn-primary"
            disabled={saving || loading}
          >
            {saving ? "Speichern ..." : "Speichern"}
          </button>
          <div className="flex items-center gap-2">
            <input
              className="input"
              placeholder="Test-Empfänger"
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={onTest}
              disabled={testing || loading}
            >
              {testing ? "Testet ..." : "Testmail senden"}
            </button>
          </div>
        </div>
      </form>
      {status && (
        <div
          className={`mt-4 text-sm rounded-md px-3 py-2 ${
            status.type === "success"
              ? "bg-green-50 text-green-800 border border-green-100"
              : status.type === "info"
              ? "bg-blue-50 text-blue-800 border border-blue-100"
              : "bg-red-50 text-red-700 border border-red-100"
          }`}
        >
          {status.message}
        </div>
      )}
      {testResult && (
        <div
          className={`mt-3 text-sm rounded-md px-3 py-2 ${
            testResult.type === "success"
              ? "bg-green-50 text-green-800 border border-green-100"
              : testResult.type === "info"
              ? "bg-blue-50 text-blue-800 border border-blue-100"
              : "bg-red-50 text-red-700 border border-red-100"
          }`}
        >
          {testResult.message}
        </div>
      )}
    </div>
  );
}

function EmailTemplatesSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<FormStatus>(null);
  const [form, setForm] = useState<{
    subject_template: string;
    body_text_template: string;
    updated_at?: string | null;
  }>({
    subject_template: "",
    body_text_template: "",
  });
  const [preview, setPreview] = useState<{ loading: boolean; data: any | null; error: string | null }>({ loading: false, data: null, error: null });
  const [previewId, setPreviewId] = useState<string>("");

  useEffect(() => {
    setStatus(null);
    getEmailTemplates()
      .then((data) =>
        setForm({
          subject_template: data.subject_template || "",
          body_text_template: data.body_text_template || "",
          updated_at: data.updated_at || null,
        })
      )
      .catch((err: ApiError) => setStatus({ type: "error", message: err.message || "Templates konnten nicht geladen werden." }))
      .finally(() => setLoading(false));
  }, []);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const saved = await saveEmailTemplates({
        subject_template: form.subject_template,
        body_text_template: form.body_text_template || null,
      });
      setForm((f) => ({
        ...f,
        subject_template: saved.subject_template,
        body_text_template: saved.body_text_template,
        updated_at: saved.updated_at,
      }));
      setStatus({ type: "success", message: "Vorlage gespeichert." });
    } catch (err: any) {
      const apiErr = err as ApiError;
      setStatus({ type: "error", message: apiErr.message || "Speichern fehlgeschlagen." });
    } finally {
      setSaving(false);
    }
  };

  const onPreview = async () => {
    if (!previewId.trim()) {
      setStatus({ type: "error", message: "Bitte eine Rechnungs-ID für die Vorschau angeben." });
      return;
    }
    setPreview({ loading: true, data: null, error: null });
    try {
      const data = await fetch(`/api/invoices/${Number(previewId)}/email-preview`, { credentials: "include" }).then((r) => r.json());
      setPreview({ loading: false, data, error: null });
    } catch (err: any) {
      const apiErr = err as ApiError;
      setPreview({ loading: false, data: null, error: apiErr.message || "Vorschau fehlgeschlagen." });
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">E-Mail Vorlagen</h2>
        <p className="text-sm text-slate-600">
          Globale Vorlagen für Betreff und Body. Kategorie-spezifische Templates haben Vorrang.
        </p>
      </div>

      <form className="space-y-3" onSubmit={onSave}>
        <label className="text-sm text-slate-700 block">
          <span className="font-medium">Betreff</span>
          <Input
            value={form.subject_template}
            onChange={(e) => setForm((f) => ({ ...f, subject_template: e.target.value }))}
            disabled={loading}
          />
        </label>
        <label className="text-sm text-slate-700 block">
          <span className="font-medium">Body (Text, Platzhalter erlaubt)</span>
          <Textarea
            className="min-h-[140px]"
            value={form.body_text_template}
            onChange={(e) => setForm((f) => ({ ...f, body_text_template: e.target.value }))}
            disabled={loading}
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={saving || loading}>
            {saving ? "Speichere ..." : "Speichern"}
          </Button>
          {status && <Alert type={status.type === "success" ? "success" : "error"}>{status.message}</Alert>}
          {form.updated_at && (
            <span className="text-xs text-slate-500">
              Aktualisiert: {new Date(form.updated_at).toLocaleString()}
            </span>
          )}
        </div>
      </form>

      <div className="border border-dashed border-slate-200 rounded-md p-3 bg-slate-50">
        <div className="font-semibold text-sm mb-1">Platzhalter</div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-700">
          {EMAIL_PLACEHOLDERS.map((p) => (
            <code key={p} className="px-2 py-1 bg-white border border-slate-200 rounded">
              {p}
            </code>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Rechnungs-ID für Vorschau"
            value={previewId}
            onChange={(e) => setPreviewId(e.target.value)}
            className="w-60"
          />
          <Button variant="secondary" type="button" onClick={onPreview} disabled={preview.loading}>
            {preview.loading ? "Lädt ..." : "Vorschau laden"}
          </Button>
        </div>
        {preview.error && <Alert type="error">{preview.error}</Alert>}
        {preview.data && (
          <div className="space-y-3">
            <div>
              <div className="font-semibold">Betreff</div>
              <div className="text-sm">{preview.data.subject}</div>
            </div>
            <div>
              <div className="font-semibold">HTML</div>
              <div
                className="border border-slate-200 rounded p-3 prose prose-sm max-w-none bg-white"
                dangerouslySetInnerHTML={{ __html: preview.data.body_html || "<em>(leer)</em>" }}
              />
            </div>
            <div>
              <div className="font-semibold">Text</div>
              <pre className="border border-slate-200 rounded p-3 whitespace-pre-wrap text-sm bg-white">
                {preview.data.body_text || "(leer)"}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InvoiceSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<FormStatus>(null);
  const [form, setForm] = useState<{
    company_name: string;
    address_line1: string;
    address_line2: string;
    zip: string;
    city: string;
    country: string;
    phone: string;
    vat_id: string;
    account_holder: string;
    bank_name: string;
    iban: string;
    bic: string;
    tax_number: string;
    footer_text: string;
  }>({
    company_name: "",
    address_line1: "",
    address_line2: "",
    zip: "",
    city: "",
    country: "",
    phone: "",
    vat_id: "",
    account_holder: "",
    bank_name: "",
    iban: "",
    bic: "",
    tax_number: "",
    footer_text: "",
  });

  useEffect(() => {
    setStatus(null);
    setLoading(true);
    Promise.all([getInvoiceHeader(), getBankSettings(), getTaxSettings()])
      .then(([header, bank, tax]) => {
        setForm({
          company_name: header.company_name || "",
          address_line1: header.address_line1 || "",
          address_line2: header.address_line2 || "",
          zip: header.zip || "",
          city: header.city || "",
          country: header.country || "",
          phone: header.phone || "",
          vat_id: tax.vat_id || header.vat_id || "",
          account_holder: bank.account_holder || "",
          bank_name: bank.bank_name || header.bank_name || "",
          iban: bank.iban || header.iban || "",
          bic: bank.bic || header.bic || "",
          tax_number: tax.tax_number || "",
          footer_text: header.footer_text || "",
        });
      })
      .catch((err: ApiError) =>
        setStatus({ type: "error", message: err.message || "Konnte Rechnungsdaten nicht laden." })
      )
      .finally(() => setLoading(false));
  }, []);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      await Promise.all([
        updateInvoiceHeader({
          company_name: form.company_name || null,
          address_line1: form.address_line1 || null,
          address_line2: form.address_line2 || null,
          zip: form.zip || null,
          city: form.city || null,
          country: form.country || null,
          phone: form.phone || null,
          vat_id: form.vat_id || null,
          bank_name: form.bank_name || null,
          iban: form.iban || null,
          bic: form.bic || null,
          footer_text: form.footer_text || null,
        }),
        updateBankSettings({
          account_holder: form.account_holder,
          bank_name: form.bank_name,
          iban: form.iban,
          bic: form.bic,
        }),
        updateTaxSettings({
          tax_number: form.tax_number || null,
          vat_id: form.vat_id || null,
        }),
      ]);
      setStatus({ type: "success", message: "Rechnungsdaten gespeichert." });
    } catch (err: any) {
      const apiErr = err as ApiError;
      setStatus({ type: "error", message: apiErr.message || "Speichern fehlgeschlagen." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Rechnungen</h2>
        {loading && <span className="text-sm text-slate-500">Lade ...</span>}
      </div>
      <p className="text-sm text-slate-600 mb-3">
        Änderungen wirken auf neu generierte PDFs. Für bestehende Rechnungen bitte “PDF neu erstellen” verwenden.
      </p>
      <form className="grid gap-4 md:grid-cols-2" onSubmit={onSave}>
        <Field label="Firma">
          <input
            value={form.company_name}
            onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
            className="input"
          />
        </Field>
        <Field label="USt-IdNr.">
          <input
            value={form.vat_id}
            onChange={(e) => setForm((f) => ({ ...f, vat_id: e.target.value }))}
            className="input"
          />
        </Field>
        <Field label="Inhaber">
          <input
            value={form.address_line1}
            onChange={(e) => setForm((f) => ({ ...f, address_line1: e.target.value }))}
            className="input"
          />
        </Field>
        <Field label="Straße">
          <input
            value={form.address_line2}
            onChange={(e) => setForm((f) => ({ ...f, address_line2: e.target.value }))}
            className="input"
          />
        </Field>
        <Field label="PLZ">
          <input
            value={form.zip}
            onChange={(e) => setForm((f) => ({ ...f, zip: e.target.value }))}
            className="input"
          />
        </Field>
        <Field label="Ort">
          <input
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            className="input"
          />
        </Field>
        <Field label="Land">
          <input
            value={form.country}
            onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
            className="input"
          />
        </Field>
        <Field label="Telefon">
          <input
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className="input"
          />
        </Field>
        <Field label="Kontoinhaber">
          <input
            value={form.account_holder}
            onChange={(e) => setForm((f) => ({ ...f, account_holder: e.target.value }))}
            className="input"
            required
          />
        </Field>
        <Field label="Bank">
          <input
            value={form.bank_name}
            onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))}
            className="input"
            required
          />
        </Field>
        <Field label="IBAN">
          <input
            value={form.iban}
            onChange={(e) => setForm((f) => ({ ...f, iban: e.target.value }))}
            className="input"
            required
          />
        </Field>
        <Field label="BIC">
          <input
            value={form.bic}
            onChange={(e) => setForm((f) => ({ ...f, bic: e.target.value }))}
            className="input"
            required
          />
        </Field>
        <Field label="Steuernummer">
          <input
            value={form.tax_number}
            onChange={(e) => setForm((f) => ({ ...f, tax_number: e.target.value }))}
            className="input"
          />
        </Field>
        <Field label="Fußzeile" className="md:col-span-2">
          <textarea
            value={form.footer_text}
            onChange={(e) => setForm((f) => ({ ...f, footer_text: e.target.value }))}
            className="input min-h-[90px]"
          />
        </Field>
        <div className="md:col-span-2">
          <button type="submit" className="btn-primary" disabled={saving || loading}>
            {saving ? "Speichern ..." : "Speichern"}
          </button>
        </div>
      </form>
      {status && (
        <div
          className={`mt-4 text-sm rounded-md px-3 py-2 ${
            status.type === "success"
              ? "bg-green-50 text-green-800 border border-green-100"
              : "bg-red-50 text-red-700 border border-red-100"
          }`}
        >
          {status.message}
        </div>
      )}
    </div>
  );
}


function ApiKeysSection() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<FormStatus>(null);
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [creating, setCreating] = useState(false);
  const [rotatingId, setRotatingId] = useState<number | null>(null);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [lastPlain, setLastPlain] = useState<{ api_key: string; prefix: string } | null>(null);

  const load = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await listApiKeys();
      setKeys(res);
    } catch (err: any) {
      const apiErr = err as ApiError;
      setStatus({ type: "error", message: apiErr.message || "API-Keys konnten nicht geladen werden." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onCreate = async () => {
    setCreating(true);
    setStatus(null);
    try {
      const res = await createApiKey({ name: newKeyName || null });
      setLastPlain({ api_key: res.api_key, prefix: res.prefix });
      setNewKeyName("");
      await load();
      setStatus({ type: "success", message: "API-Key erstellt. Kopiere ihn jetzt – später nicht mehr sichtbar!" });
    } catch (err: any) {
      const apiErr = err as ApiError;
      setStatus({ type: "error", message: apiErr.message || "API-Key konnte nicht erstellt werden." });
    } finally {
      setCreating(false);
    }
  };

  const onRotate = async (id: number) => {
    setRotatingId(id);
    setStatus(null);
    try {
      const res = await rotateApiKey(id);
      setLastPlain({ api_key: res.api_key, prefix: res.prefix });
      await load();
      setStatus({ type: "success", message: "API-Key rotiert. Neuer Key wird nur einmal angezeigt!" });
    } catch (err: any) {
      const apiErr = err as ApiError;
      setStatus({ type: "error", message: apiErr.message || "Rotation fehlgeschlagen." });
    } finally {
      setRotatingId(null);
    }
  };

  const onRevoke = async (id: number) => {
    if (!confirm("API-Key wirklich widerrufen?")) return;
    setRevokingId(id);
    setStatus(null);
    try {
      await revokeApiKey(id);
      await load();
      setStatus({ type: "success", message: "API-Key widerrufen." });
    } catch (err: any) {
      const apiErr = err as ApiError;
      setStatus({ type: "error", message: apiErr.message || "Widerruf fehlgeschlagen." });
    } finally {
      setRevokingId(null);
    }
  };

  const onDelete = async (id: number) => {
    if (!confirm("API-Key wirklich löschen? (Aktion kann nicht rückgängig gemacht werden)")) return;
    setDeletingId(id);
    setStatus(null);
    try {
      await deleteApiKey(id);
      await load();
      setStatus({ type: "success", message: "API-Key gelöscht." });
    } catch (err: any) {
      const apiErr = err as ApiError;
      setStatus({ type: "error", message: apiErr.message || "Löschen fehlgeschlagen." });
    } finally {
      setDeletingId(null);
    }
  };

  const copyKey = async () => {
    if (!lastPlain?.api_key) return;
    await navigator.clipboard.writeText(lastPlain.api_key);
    setStatus({ type: "success", message: "API-Key kopiert." });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">API Keys</h2>
        {loading && <span className="text-sm text-slate-500">Lade ...</span>}
      </div>
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          className="input w-60"
          placeholder="Name (optional)"
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
        />
        <button className="btn-primary" onClick={onCreate} disabled={creating || loading}>
          {creating ? "Erstelle ..." : "Neuen Key erstellen"}
        </button>
      </div>

      {lastPlain && (
        <div className="mb-4 p-3 rounded-md border border-amber-200 bg-amber-50 text-sm text-amber-900">
          Neuer Key (nur jetzt sichtbar):<br />
          <code className="block break-all mt-1 font-mono text-xs bg-white border border-amber-200 rounded px-2 py-1">
            {lastPlain.api_key}
          </code>
          <div className="mt-2 flex gap-2">
            <button className="btn-secondary" onClick={copyKey}>Kopieren</button>
            <span className="text-xs text-amber-800">
              Speichere den Key sicher – nach dem Schließen dieser Meldung ist er nicht mehr abrufbar.
            </span>
          </div>
        </div>
      )}

      <div className="overflow-x-auto overflow-y-visible">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b border-slate-200">
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Prefix</th>
              <th className="py-2 pr-3">Erstellt</th>
              <th className="py-2 pr-3">Zuletzt genutzt</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => {
              const revoked = Boolean(k.revoked_at);
              return (
                <tr key={k.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3">{k.name || "–"}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{k.prefix}</td>
                  <td className="py-2 pr-3">{new Date(k.created_at).toLocaleString()}</td>
                  <td className="py-2 pr-3">
                    {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "–"}
                  </td>
                  <td className="py-2 pr-3">
                    {revoked ? (
                      <span className="text-red-600">widerrufen</span>
                    ) : (
                      <span className="text-green-600">aktiv</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right flex gap-2 justify-end">
                    <button
                      className="btn-secondary"
                      onClick={() => onRotate(k.id)}
                      disabled={rotatingId === k.id}
                    >
                      {rotatingId === k.id ? "rotiert..." : "Rotieren"}
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => onRevoke(k.id)}
                      disabled={revokingId === k.id || revoked}
                    >
                      {revokingId === k.id ? "widerrufe..." : "Widerrufen"}
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => onDelete(k.id)}
                      disabled={deletingId === k.id}
                    >
                      {deletingId === k.id ? "lösche..." : "Löschen"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {!keys.length && (
              <tr>
                <td colSpan={6} className="py-3 text-slate-500">
                  Noch keine API Keys vorhanden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {status && (
        <div
          className={`mt-4 text-sm rounded-md px-3 py-2 ${
            status.type === "success"
              ? "bg-green-50 text-green-800 border border-green-100"
              : "bg-red-50 text-red-700 border border-red-100"
          }`}
        >
          {status.message}
        </div>
      )}
    </div>
  );
}

function AdminUsers() {
  const { user } = useAuth();
  const isAdmin = user?.role_name === "admin";
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<FormStatus>(null);
  const [modal, setModal] = useState<{ mode: "create" | "edit"; user?: User } | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const withRoleName = (u: User) => ({
    ...u,
    role_name: roles.find((r) => r.id === u.role_id)?.name || u.role_name || null,
  });

  const load = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const [roleRes, userRes] = await Promise.all([listRoles(), listUsers()]);
      setRoles(roleRes);
      setUsers(userRes);
    } catch (err: any) {
      const apiErr = err as ApiError;
      setStatus({ type: "error", message: apiErr.message || "Benutzer konnten nicht geladen werden." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  if (!isAdmin) {
    return <Alert type="error">Keine Berechtigung.</Alert>;
  }

  const onDelete = async (id: number) => {
    setBusyId(id);
    setStatus(null);
    try {
      await deleteUserApi(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      setStatus({ type: "success", message: "Benutzer gelöscht." });
    } catch (err: any) {
      const apiErr = err as ApiError;
      setStatus({ type: "error", message: apiErr.message || "Löschen fehlgeschlagen." });
    } finally {
      setBusyId(null);
      setConfirmId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Benutzer</h1>
          <p className="text-slate-600 text-sm">Admin-Bereich: Benutzer anlegen, Rollen zuweisen.</p>
        </div>
        <Button onClick={() => setModal({ mode: "create" })}>Neu</Button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-600">
          <Spinner /> Lade Benutzer ...
        </div>
      )}

      {!loading && (
        <div className="overflow-x-auto overflow-y-visible bg-white border border-slate-200 rounded-lg shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200 bg-slate-50">
                <th className="px-3 py-2">Benutzername</th>
                <th className="px-3 py-2">Rolle</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Erstellt</th>
                <th className="px-3 py-2 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-medium">{u.username}</td>
                  <td className="px-3 py-2">{u.role_name || "—"}</td>
                  <td className="px-3 py-2">
                    {u.is_active ? <Badge tone="green">aktiv</Badge> : <Badge tone="amber">inaktiv</Badge>}
                  </td>
                  <td className="px-3 py-2">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-3 py-2 text-right flex gap-2 justify-end">
                    <Button variant="secondary" onClick={() => setModal({ mode: "edit", user: u })}>
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => setConfirmId(u.id)}
                      disabled={busyId === u.id}
                    >
                      {busyId === u.id ? "..." : "Delete"}
                    </Button>
                  </td>
                </tr>
              ))}
              {!users.length && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-slate-500">
                    Keine Benutzer vorhanden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {status && <Alert type={status.type === "success" ? "success" : "error"}>{status.message}</Alert>}

      {modal && (
        <UserModal
          mode={modal.mode}
          user={modal.user}
          roles={roles}
          onClose={() => setModal(null)}
          onSaved={(saved) => {
            const shaped = withRoleName(saved);
            if (modal.mode === "edit" && saved) {
              setUsers((prev) => prev.map((u) => (u.id === shaped.id ? shaped : u)));
            } else if (saved) {
              setUsers((prev) => [...prev, shaped]);
            }
            setStatus({ type: "success", message: "Benutzer gespeichert." });
          }}
          onError={(msg) => setStatus({ type: "error", message: msg })}
        />
      )}

      {confirmId !== null && (
        <Confirm
          title="Benutzer löschen?"
          description="Dieser Vorgang kann nicht rückgängig gemacht werden."
          onConfirm={() => onDelete(confirmId)}
          onCancel={() => setConfirmId(null)}
          busy={busyId === confirmId}
        />
      )}
    </div>
  );
}

function UserModal({
  mode,
  user,
  roles,
  onClose,
  onSaved,
  onError,
}: {
  mode: "create" | "edit";
  user?: User;
  roles: Role[];
  onClose: () => void;
  onSaved: (u: User) => void;
  onError: (msg: string) => void;
}) {
  const [form, setForm] = useState({
    username: user?.username || "",
    password: "",
    role_id: user?.role_id || null,
    is_active: user?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.username.trim()) {
      setError("Benutzername ist erforderlich.");
      return;
    }
    if (mode === "create" && !form.password.trim()) {
      setError("Passwort ist erforderlich.");
      return;
    }
    setSaving(true);
    try {
      if (mode === "create") {
        const res = await createUserApi({
          username: form.username.trim(),
          password: form.password,
          role_id: form.role_id || undefined,
        });
        onSaved(res);
      } else if (user) {
        const res = await updateUserApi(user.id, {
          username: form.username.trim(),
          role_id: form.role_id || null,
          is_active: form.is_active,
        });
        onSaved(res);
      }
      onClose();
    } catch (err: any) {
      const apiErr = err as ApiError;
      const msg =
        apiErr.status === 409
          ? "Benutzername existiert bereits."
          : apiErr.message || "Speichern fehlgeschlagen.";
      setError(msg);
      onError(msg);
      return;
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={mode === "create" ? "Neuer Benutzer" : "Benutzer bearbeiten"} onClose={onClose}>
      <form className="space-y-3" onSubmit={onSubmit}>
        <Field label="Benutzername">
          <Input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} />
        </Field>
        {mode === "create" && (
          <Field label="Passwort">
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </Field>
        )}
        <Field label="Rolle">
          <Select
            value={form.role_id ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, role_id: e.target.value ? Number(e.target.value) : null }))}
          >
            <option value="">– Standard –</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
          />
          <span>Aktiv</span>
        </label>

        {error && <Alert type="error">{error}</Alert>}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Speichern ..." : "Speichern"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function AdminRoles() {
  const { user } = useAuth();
  const isAdmin = user?.role_name === "admin";
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<FormStatus>(null);
  const [modal, setModal] = useState<{ mode: "create" | "edit"; role?: Role } | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await listRoles();
      setRoles(res);
    } catch (err: any) {
      const apiErr = err as ApiError;
      setStatus({ type: "error", message: apiErr.message || "Rollen konnten nicht geladen werden." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  if (!isAdmin) return <Alert type="error">Keine Berechtigung.</Alert>;

  const onDelete = async (id: number) => {
    setBusyId(id);
    setStatus(null);
    try {
      await deleteRoleApi(id);
      setRoles((prev) => prev.filter((r) => r.id !== id));
      setStatus({ type: "success", message: "Rolle gelöscht." });
    } catch (err: any) {
      const apiErr = err as ApiError;
      setStatus({ type: "error", message: apiErr.message || "Löschen fehlgeschlagen." });
    } finally {
      setBusyId(null);
      setConfirmId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Rollen & Berechtigungen</h1>
          <p className="text-slate-600 text-sm">Definiere Rollen und zugehörige Rechte.</p>
        </div>
        <Button onClick={() => setModal({ mode: "create" })}>Neue Rolle</Button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-600">
          <Spinner /> Lade Rollen ...
        </div>
      )}

      {!loading && (
        <div className="overflow-x-auto overflow-y-visible bg-white border border-slate-200 rounded-lg shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200 bg-slate-50">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Beschreibung</th>
                <th className="px-3 py-2 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2 text-slate-600">{r.description || "–"}</td>
                  <td className="px-3 py-2 text-right flex gap-2 justify-end">
                    <Button variant="secondary" onClick={() => setModal({ mode: "edit", role: r })}>
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => setConfirmId(r.id)}
                      disabled={busyId === r.id}
                    >
                      {busyId === r.id ? "..." : "Delete"}
                    </Button>
                  </td>
                </tr>
              ))}
              {!roles.length && (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-slate-500">
                    Keine Rollen vorhanden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {status && <Alert type={status.type === "success" ? "success" : "error"}>{status.message}</Alert>}

      {modal && (
        <RoleModal
          mode={modal.mode}
          role={modal.role}
          onClose={() => setModal(null)}
          onSaved={() => {
            load();
            setStatus({ type: "success", message: "Rolle gespeichert." });
          }}
          onError={(msg) => setStatus({ type: "error", message: msg })}
        />
      )}

      {confirmId !== null && (
        <Confirm
          title="Rolle löschen?"
          description="Rolle wird entfernt. Prüfe zugewiesene Benutzer."
          onConfirm={() => onDelete(confirmId)}
          onCancel={() => setConfirmId(null)}
          busy={busyId === confirmId}
        />
      )}
    </div>
  );
}

function RoleModal({
  mode,
  role,
  onClose,
  onSaved,
  onError,
}: {
  mode: "create" | "edit";
  role?: Role;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [form, setForm] = useState({
    name: role?.name || "",
    description: role?.description || "",
    permissions: [] as string[],
  });
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "edit" && role) {
      getRolePermissionsApi(role.id)
        .then((perms) => setForm((f) => ({ ...f, permissions: perms })))
        .catch((err: ApiError) => setError(err.message || "Konnte Berechtigungen nicht laden."))
        .finally(() => setLoading(false));
    }
  }, [mode, role]);

  const togglePerm = (key: string) => {
    setForm((f) => {
      const exists = f.permissions.includes(key);
      return { ...f, permissions: exists ? f.permissions.filter((p) => p !== key) : [...f.permissions, key] };
    });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError("Name ist erforderlich.");
      return;
    }
    setSaving(true);
    try {
      if (mode === "create") {
        await createRoleApi({
          name: form.name.trim(),
          description: form.description || null,
          permissions: form.permissions,
        });
      } else if (role) {
        await updateRoleApi(role.id, {
          name: form.name.trim(),
          description: form.description || null,
          permissions: form.permissions,
        });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      const apiErr = err as ApiError;
      setError(apiErr.message || "Speichern fehlgeschlagen.");
      onError(apiErr.message || "Speichern fehlgeschlagen.");
      return;
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={mode === "create" ? "Neue Rolle" : "Rolle bearbeiten"} onClose={onClose}>
      {loading ? (
        <div className="flex items-center gap-2 text-slate-600">
          <Spinner /> Lade Berechtigungen ...
        </div>
      ) : (
        <form className="space-y-3" onSubmit={onSubmit}>
          <Field label="Name">
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Beschreibung (optional)">
            <Input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </Field>
          <div className="space-y-2">
            <div className="font-semibold text-sm">Berechtigungen</div>
            <div className="grid md:grid-cols-2 gap-2 max-h-72 overflow-y-auto border border-slate-200 rounded-md p-3">
              {PERMISSION_OPTIONS.map((perm) => (
                <label key={perm.key} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.permissions.includes(perm.key)}
                    onChange={() => togglePerm(perm.key)}
                  />
                  <span>{perm.label}</span>
                </label>
              ))}
            </div>
          </div>

          {error && <Alert type="error">{error}</Alert>}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={onClose}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Speichern ..." : "Speichern"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function BankTaxSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<FormStatus>(null);
  const [bank, setBank] = useState<BankSettings>({
    account_holder: "",
    bank_name: "",
    iban: "",
    bic: "",
  });
  const [tax, setTax] = useState<TaxSettings>({ tax_number: "", vat_id: "" });

  useEffect(() => {
    setStatus(null);
    setLoading(true);
    Promise.all([getBankSettings(), getTaxSettings()])
      .then(([b, t]) => {
        setBank({
          account_holder: b.account_holder || "",
          bank_name: b.bank_name || "",
          iban: b.iban || "",
          bic: b.bic || "",
        });
        setTax({
          tax_number: t.tax_number || "",
          vat_id: t.vat_id || "",
        });
      })
      .catch((err: ApiError) => {
        setStatus({ type: "error", message: err.message || "Konnte Bank-/Steuer-Daten nicht laden." });
      })
      .finally(() => setLoading(false));
  }, []);

  const saveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      await updateBankSettings({
        account_holder: bank.account_holder,
        bank_name: bank.bank_name,
        iban: bank.iban,
        bic: bank.bic,
      });
      await updateTaxSettings({
        tax_number: tax.tax_number || null,
        vat_id: tax.vat_id || null,
      });
      setStatus({ type: "success", message: "Bank- und Steuerdaten gespeichert." });
    } catch (err: any) {
      const apiErr = err as ApiError;
      setStatus({ type: "error", message: apiErr.message || "Daten konnten nicht gespeichert werden." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Bank & Steuer</h2>
        {loading && <span className="text-sm text-slate-500">Lade ...</span>}
      </div>

      <form className="grid gap-3 md:grid-cols-2" onSubmit={saveAll}>
        <Field label="Kontoinhaber">
          <Input
            value={bank.account_holder}
            onChange={(e) => setBank((f) => ({ ...f, account_holder: e.target.value }))}
            required
          />
        </Field>
        <Field label="Bankname">
          <Input
            value={bank.bank_name}
            onChange={(e) => setBank((f) => ({ ...f, bank_name: e.target.value }))}
            required
          />
        </Field>
        <Field label="IBAN">
          <Input
            value={bank.iban}
            onChange={(e) => setBank((f) => ({ ...f, iban: e.target.value }))}
            required
          />
        </Field>
        <Field label="BIC">
          <Input
            value={bank.bic}
            onChange={(e) => setBank((f) => ({ ...f, bic: e.target.value }))}
            required
          />
        </Field>
        <Field label="Steuernummer">
          <Input value={tax.tax_number || ""} onChange={(e) => setTax((f) => ({ ...f, tax_number: e.target.value }))} />
        </Field>
        <Field label="USt-IdNr.">
          <Input value={tax.vat_id || ""} onChange={(e) => setTax((f) => ({ ...f, vat_id: e.target.value }))} />
        </Field>
        <div className="md:col-span-2 flex justify-end">
          <Button type="submit" disabled={saving || loading}>
            {saving ? "Speichert ..." : "Bank- & Steuerdaten speichern"}
          </Button>
        </div>
      </form>

      {status && (
        <Alert type={status.type === "success" ? "success" : status.type === "info" ? "info" : "error"}>
          {status.message}
        </Alert>
      )}
    </div>
  );
}

function DatevSettingsForm() {
  const [form, setForm] = useState<DatevSettings>({ email: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<FormStatus>(null);

  useEffect(() => {
    setLoading(true);
    setStatus(null);
    getDatevSettings()
      .then((d) => setForm({ email: d.email || "" }))
      .catch((err: ApiError) => setStatus({ type: "error", message: err.message || "DATEV konnte nicht geladen werden." }))
      .finally(() => setLoading(false));
  }, []);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      await updateDatevSettings({ email: form.email || null });
      setStatus({ type: "success", message: "DATEV-Einstellungen gespeichert." });
    } catch (err: any) {
      const apiErr = err as ApiError;
      setStatus({ type: "error", message: apiErr.message || "DATEV-Einstellungen konnten nicht gespeichert werden." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">DATEV</h2>
        {loading && <span className="text-sm text-slate-500">Lade ...</span>}
      </div>
      <p className="text-sm text-slate-600">
        Hinterlege die DATEV-E-Mail, die für Exporte genutzt werden soll.
      </p>
      <form className="grid gap-3 md:grid-cols-2" onSubmit={onSave}>
        <Field label="DATEV E-Mail">
          <Input
            type="email"
            value={form.email || ""}
            onChange={(e) => setForm({ email: e.target.value })}
            required
          />
        </Field>
        <div className="md:col-span-2 flex justify-end">
          <Button type="submit" disabled={saving || loading}>
            {saving ? "Speichert ..." : "Speichern"}
          </Button>
        </div>
      </form>
      {status && <Alert type={status.type === "success" ? "success" : "error"}>{status.message}</Alert>}
    </div>
  );
}

function HkformsSettingsForm() {
  const [form, setForm] = useState<HkformsSettings & { api_key?: string }>({
    base_url: "",
    organization: "",
    has_api_key: false,
    api_key: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<FormStatus>(null);
  const [testResult, setTestResult] = useState<FormStatus>(null);

  useEffect(() => {
    setLoading(true);
    setStatus(null);
    getHkformsSettings()
      .then((d) =>
        setForm({
          base_url: d.base_url || "",
          organization: d.organization || "",
          has_api_key: Boolean(d.has_api_key),
          api_key: "",
        })
      )
      .catch((err: ApiError) => setStatus({ type: "error", message: err.message || "Forms-Sync konnte nicht geladen werden." }))
      .finally(() => setLoading(false));
  }, []);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    setTestResult(null);
    try {
      const payload: any = {
        base_url: form.base_url,
        organization: form.organization || null,
      };
      if (form.api_key) payload.api_key = form.api_key;
      const saved = await updateHkformsSettings(payload);
      setForm((prev) => ({
        ...prev,
        base_url: saved.base_url || prev.base_url,
        organization: saved.organization || "",
        has_api_key: Boolean(saved.has_api_key),
        api_key: "",
      }));
      setStatus({ type: "success", message: "Forms-Sync-Einstellungen gespeichert." });
    } catch (err: any) {
      const apiErr = err as ApiError;
      setStatus({ type: "error", message: apiErr.message || "Forms-Sync-Einstellungen konnten nicht gespeichert werden." });
    } finally {
      setSaving(false);
    }
  };

  const onTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testHkforms({
        base_url: form.base_url,
        organization: form.organization || undefined,
        api_key: form.api_key || undefined,
      });
      setTestResult({
        type: res.ok ? "success" : "info",
        message: res.message || "Test abgeschlossen.",
      });
    } catch (err: any) {
      const apiErr = err as ApiError;
      setTestResult({ type: "error", message: apiErr.message || "Test fehlgeschlagen." });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Forms-Sync</h2>
        {loading && <span className="text-sm text-slate-500">Lade ...</span>}
      </div>
      <p className="text-sm text-slate-600">
        Basis für Status-Sync und Overdue-Job. API-Schlüssel wird nur einmalig gesendet (write-only).
      </p>
      <form className="grid gap-3 md:grid-cols-2" onSubmit={onSave}>
        <Field label="Base URL">
          <Input
            value={form.base_url}
            onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))}
            required
          />
        </Field>
        <Field label="Organisation (optional)">
          <Input
            value={form.organization || ""}
            onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))}
          />
        </Field>
        <div className="md:col-span-2 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-700 font-medium">API Key</span>
            {form.has_api_key ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-200">
                hinterlegt
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                fehlt
              </span>
            )}
          </div>
          <Input
            type="password"
            value={form.api_key || ""}
            onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
            placeholder="Nur ausfüllen, wenn du den Key setzen/ändern willst"
          />
          <p className="text-xs text-slate-500">
            Der API-Key wird nicht im Klartext angezeigt. Nach dem Speichern wird das Feld geleert.
          </p>
        </div>
        <div className="md:col-span-2 flex flex-wrap gap-3">
          <Button type="submit" disabled={saving || loading}>
            {saving ? "Speichert ..." : "Speichern"}
          </Button>
          <Button type="button" variant="secondary" onClick={onTest} disabled={testing || loading}>
            {testing ? "Testet ..." : "Verbindung testen"}
          </Button>
        </div>
      </form>
      {status && <Alert type={status.type === "success" ? "success" : "error"}>{status.message}</Alert>}
      {testResult && (
        <Alert type={testResult.type === "success" ? "success" : testResult.type === "info" ? "info" : "error"}>
          {testResult.message}
        </Alert>
      )}
    </div>
  );
}

function StatsPage() {
  const { user } = useAuth();
  const canView = user?.role_name === "admin" || (user?.permissions || []).includes("stats.view");
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<InvoiceStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const initialYear = searchParams.get("year") || "";
  const initialCategory = searchParams.get("category") || "all";
  const [year, setYear] = useState<string>(initialYear);
  const [category, setCategory] = useState<string>(initialCategory);
  const [refreshFlag, setRefreshFlag] = useState(0);

  useEffect(() => {
    if (!canView) return;
    let isCancelled = false;
    const fetchStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getInvoiceStats({
          year: year ? Number(year) : undefined,
          categories: category !== "all" ? [category] : undefined,
        });
        if (isCancelled) return;
        setData({
          overall: res.overall || ({} as any),
          byYear: res.byYear || [],
          byMonth: res.byMonth || [],
          categories: res.categories || [],
          topCustomers: res.topCustomers || [],
          topCategories: res.topCategories || [],
        });
        setLastLoadedAt(new Date());
      } catch (err: any) {
        if (isCancelled) return;
        const apiErr = err as ApiError;
        const msg =
          apiErr.status === 403
            ? "Keine Berechtigung für Statistiken."
            : apiErr.message || "Stats konnten nicht geladen werden.";
        setError(msg);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };
    fetchStats();
    return () => {
      isCancelled = true;
    };
  }, [canView, year, category, refreshFlag]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (year) params.set("year", year);
    if (category && category !== "all") params.set("category", category);
    setSearchParams(params, { replace: true });
  }, [year, category, setSearchParams]);

  const clearFilters = () => {
    setYear("");
    setCategory("all");
    setRefreshFlag((v) => v + 1);
  };

  const years = useMemo(() => {
    if (!data?.byYear?.length) return [];
    const list = Array.from(new Set(data.byYear.map((b) => b.year))).sort((a, b) => b - a);
    return list;
  }, [data]);

  if (!canView) {
    return <Alert type="error">Keine Berechtigung für Statistiken.</Alert>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Statistiken</h1>
          <p className="text-slate-600 text-sm">Umsätze und Status gefiltert nach Jahr/Kategorie.</p>
        </div>
        <MoreMenu items={[{ label: "Aktualisieren", onClick: () => setRefreshFlag((v) => v + 1) }]} />
      </div>

      <div className="grid gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 text-sm">
        <Select value={year} onChange={(e) => setYear(e.target.value)} className="h-9 text-sm">
          <option value="">Alle Jahre</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 text-sm col-span-2 sm:col-span-1">
          <option value="all">Alle Kategorien</option>
          {data?.categories?.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label || c.key}
            </option>
          ))}
        </Select>
        <Button variant="ghost" onClick={clearFilters} className="h-9 text-sm col-span-2 sm:col-span-1">
          Filter zurücksetzen
        </Button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-600">
          <Spinner /> Lade Statistiken ...
        </div>
      )}
      {error && (
        <Alert type="error">
          {error}{" "}
          <Button variant="ghost" onClick={() => setRefreshFlag((v) => v + 1)}>
            Erneut versuchen
          </Button>
        </Alert>
      )}

      {!loading && lastLoadedAt && (
        <div className="text-xs text-slate-500">Zuletzt aktualisiert: {lastLoadedAt.toLocaleString()}</div>
      )}

      {!loading && data && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
            <StatCard title="Summe (Gesamt)" value={formatEuro(data.overall.sum_total)} />
            <StatCard title="Bezahlt" value={formatEuro(data.overall.paid_sum)} />
            <StatCard title="Offen" value={formatEuro(data.overall.outstanding_sum)} />
            <StatCard title="Gesendet, unbezahlt" value={formatEuro(data.overall.sent_unpaid_sum || 0)} />
            <StatCard title="Rechnungen gesamt" value={data.overall.count} />
            <StatCard title="Bezahlt (Anzahl)" value={data.overall.paid_count} />
            <StatCard title="Offen (Anzahl)" value={data.overall.unpaid_count} />
            <StatCard title="Schnitt pro Rechnung" value={formatEuro(data.overall.avg_value)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <StatsTable
              title="Jahre"
              columns={["Jahr", "Summe", "Netto", "MwSt", "Bezahlt", "Offen", "Gesendet offen", "Ø pro Rechnung", "Anzahl"]}
              rows={data.byYear.map((b) => [
                b.year,
                formatEuro(b.sum_total),
                formatEuro(b.sum_net),
                formatEuro(b.sum_tax),
                formatEuro(b.paid_sum),
                formatEuro(b.outstanding_sum),
                formatEuro(b.sent_unpaid_sum || 0),
                formatEuro(b.avg_value),
                b.count,
              ])}
            />
            <StatsTable
              title="Monate"
              columns={["Monat", "Jahr", "Summe", "Bezahlt", "Offen", "Gesendet offen", "Ø pro Rechnung", "Anzahl"]}
              rows={(data.byMonth || []).map((m) => {
                const avg = m.count ? m.sum_total / m.count : 0;
                return [
                  m.month,
                  m.year,
                  formatEuro(m.sum_total),
                  formatEuro(m.paid_sum),
                  formatEuro(m.unpaid_sum),
                  formatEuro(m.sent_unpaid_sum || 0),
                  formatEuro(avg),
                  m.count,
                ];
              })}
              emptyText="Keine Monatsdaten"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <StatsTable
              title="Top Kunden (Umsatz)"
              columns={["Kunde", "Summe", "Ø pro Rechnung", "Anzahl"]}
              rows={(data.topCustomers || []).map((c) => [
                c.name,
                formatEuro(c.sum_total),
                formatEuro(c.count ? c.sum_total / c.count : 0),
                c.count,
              ])}
              emptyText="Keine Kundenstatistik"
            />
            <StatsTable
              title="Top Kategorien (Umsatz)"
              columns={["Kategorie", "Summe", "Ø pro Rechnung", "Anzahl"]}
              rows={(data.topCategories || []).map((c) => [
                c.label,
                formatEuro(c.sum_total),
                formatEuro(c.count ? c.sum_total / c.count : 0),
                c.count,
              ])}
              emptyText="Keine Kategorienstatistik"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="text-xl font-semibold text-slate-900 mt-1">{value}</div>
    </div>
  );
}

const formatEuro = (val: number | null | undefined) =>
  val == null ? "–" : `${Number(val).toFixed(2)} €`;

function StatsTable({
  title,
  columns,
  rows,
  emptyText = "Keine Daten vorhanden.",
}: {
  title: string;
  columns: string[];
  rows: (string | number)[][];
  emptyText?: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-visible">
      <div className="px-3 py-2 font-semibold text-slate-800 border-b border-slate-200">{title}</div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b border-slate-200 bg-slate-50">
            {columns.map((c) => (
              <th key={c} className="px-3 py-2">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={idx} className="border-b border-slate-100">
              {r.map((v, i) => (
                <td key={i} className="px-3 py-2">
                  {v}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-3 text-center text-slate-500">
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm text-slate-700 ${className}`}>
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}
