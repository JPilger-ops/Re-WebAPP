import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  ApiError,
  AuthUser,
  ApiKeyInfo,
  Customer,
  Category,
  InvoiceDetail,
  InvoiceItem,
  InvoiceListItem,
  BankSettings,
  TaxSettings,
  DatevSettings,
  HkformsSettings,
  InvoiceStatsResponse,
  User,
  Role,
  getInvoiceHeader,
  getSmtpSettings,
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
  getInvoiceStats,
  regenerateInvoicePdf,
  listApiKeys,
  createApiKey,
  rotateApiKey,
  revokeApiKey,
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
  listUsers,
  createUserApi,
  updateUserApi,
  deleteUserApi,
  listRoles,
  getRolePermissionsApi,
  createRoleApi,
  updateRoleApi,
  deleteRoleApi,
} from "./api";
import { AuthProvider, useAuth } from "./AuthProvider";
import { Alert, Button, Checkbox, Confirm, EmptyState, Input, Modal, Spinner, Textarea, Badge, SidebarLink } from "./ui";

type FormStatus = { type: "success" | "error"; message: string } | null;

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

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedLayout />}>
            <Route element={<Shell />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/stats" element={<StatsPage />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/settings" element={<AdminSettings />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/roles" element={<AdminRoles />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

function LoginPage() {
  const { user, login, error, setError } = useAuth();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

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
      await login(username, password);
      const dest = (location.state as any)?.from || "/dashboard";
      navigate(dest, { replace: true });
    } catch (err: any) {
      const apiErr = err as ApiError;
      if (apiErr.status === 429) {
        setError("Zu viele Login-Versuche. Bitte kurz warten und erneut versuchen.");
      } else if (apiErr.status === 401) {
        setError("Login fehlgeschlagen. Bitte Zugangsdaten prüfen.");
      } else {
        setError(apiErr.message || "Login fehlgeschlagen.");
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

function ProtectedLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-700">Lade Session ...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <Outlet />;
}

function Shell() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role_name === "admin";
  const hasStats = isAdmin || (user?.permissions || []).includes("stats.view");
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden rounded-md border border-slate-200 px-2 py-1"
              onClick={() => setSidebarOpen((s) => !s)}
            >
              ☰
            </button>
            <div className="font-semibold">RechnungsAPP</div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-600 hidden md:inline">
              Eingeloggt als {user?.username} {isAdmin ? "(Admin)" : ""}
            </span>
            <Button variant="secondary" onClick={logout}>
              Logout
            </Button>
          </div>
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-4 py-8 flex gap-6">
        <aside
          className={`w-56 shrink-0 bg-white border border-slate-200 rounded-lg shadow-sm p-3 h-fit ${
            sidebarOpen ? "block" : "hidden md:block"
          }`}
        >
          <nav className="flex flex-col gap-1">
            {links.map((l) => (
              <SidebarLink key={l.to} to={l.to} label={l.label} />
            ))}
          </nav>
        </aside>
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role_name === "admin";
  const hasStats = isAdmin || (user?.permissions || []).includes("stats.view");

  const cards = useMemo(
    () => ["Rechnungen", "Kunden", ...(hasStats ? ["Statistiken"] : []), "Einstellungen"],
    [hasStats],
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

  const applyFilter = (list: Customer[], term: string) => {
    const t = term.toLowerCase();
    if (!t) return list;
    return list.filter((c) =>
      [c.name, c.email, c.city, c.zip].some((v) => (v || "").toLowerCase().includes(t))
    );
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listCustomers();
      setCustomers(res);
      setFiltered(applyFilter(res, search));
    } catch (err: any) {
      const apiErr = err as ApiError;
      setError(apiErr.message || "Kunden konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setFiltered(applyFilter(customers, search));
  }, [customers, search]);

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
        <Button onClick={() => setModal({ mode: "create" })}>Neu</Button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <Input
          placeholder="Suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <Button variant="secondary" onClick={load}>Aktualisieren</Button>
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
        <div className="overflow-x-auto bg-white border border-slate-200 rounded-lg shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200 bg-slate-50">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Ort</th>
                <th className="px-3 py-2 w-32 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium">{c.name}</td>
                  <td className="px-3 py-2 text-slate-600">{c.email || "–"}</td>
                  <td className="px-3 py-2 text-slate-600">{[c.zip, c.city].filter(Boolean).join(" ") || "–"}</td>
                  <td className="px-3 py-2 text-right space-x-2">
                    <Button variant="secondary" onClick={() => setModal({ mode: "edit", customer: c })}>
                      Edit
                    </Button>
                    <Button variant="danger" onClick={() => setConfirmId(c.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
        <Button variant="secondary" onClick={load}>Aktualisieren</Button>
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
                <div className="space-x-2">
                  <Button variant="secondary" onClick={() => setModal({ mode: "edit", category: cat })}>Edit</Button>
                  <Button variant="danger" onClick={() => setConfirmId(cat.id)}>Delete</Button>
                </div>
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
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [filtered, setFiltered] = useState<InvoiceListItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "sent" | "paid">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: "create" | "edit"; id?: number } | null>(null);
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [toast, setToast] = useState<FormStatus>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ loading: boolean; data: any | null; error: string | null }>({ loading: false, data: null, error: null });
  const [sendModal, setSendModal] = useState<{ open: boolean; id?: number; to?: string; subject?: string; message?: string; includeDatev?: boolean }>({ open: false });

  const computeStatus = (inv: InvoiceListItem) => {
    if (inv.status_paid_at) return "paid";
    if (inv.status_sent) return "sent";
    return "open";
  };

  const applyFilter = (list: InvoiceListItem[], term: string, status: typeof statusFilter, categoryKey: string) => {
    const t = term.toLowerCase();
    return list.filter((inv) => {
      const matchesTerm =
        !t ||
        inv.invoice_number.toLowerCase().includes(t) ||
        (inv.recipient_name || "").toLowerCase().includes(t);
      const st = computeStatus(inv);
      const matchesStatus = status === "all" || st === status;
      const matchesCategory = categoryKey === "all" || inv.category_label === categoryKey;
      return matchesTerm && matchesStatus && matchesCategory;
    });
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, cats] = await Promise.all([listInvoices(), listCategories().catch(() => [])]);
      setInvoices(res);
      setCategories(cats);
      setFiltered(applyFilter(res, search, statusFilter, categoryFilter));
    } catch (err: any) {
      const apiErr = err as ApiError;
      setError(apiErr.message || "Rechnungen konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setFiltered(applyFilter(invoices, search, statusFilter, categoryFilter));
  }, [invoices, search, statusFilter, categoryFilter]);

  const openDetail = async (id: number) => {
    try {
      const data = await getInvoice(id);
      setDetail(data);
    } catch (err: any) {
      const apiErr = err as ApiError;
      setToast({ type: "error", message: apiErr.message || "Rechnung konnte nicht geladen werden." });
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
      setSendModal({ open: false });
    } catch (err: any) {
      const apiErr = err as ApiError;
      let msg = apiErr.message || "E-Mail konnte nicht gesendet werden.";
      if (apiErr.status === 401 || apiErr.status === 403) msg = "Keine Berechtigung.";
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

  const markAsSent = async (id: number) => {
    setBusyId(id);
    setToast(null);
    try {
      await markInvoiceSent(id);
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === id ? { ...inv, status_sent: true, status_sent_at: new Date().toISOString() } : inv))
      );
      if (detail && detail.invoice.id === id) {
        setDetail({
          ...detail,
          invoice: { ...detail.invoice, status_sent: true, status_sent_at: new Date().toISOString() },
        });
      }
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
      if (detail && detail.invoice.id === id) {
        setDetail({
          ...detail,
          invoice: { ...detail.invoice, status_paid_at: new Date().toISOString() },
        });
      }
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Rechnungen</h1>
          <p className="text-slate-600 text-sm">PDF-Aktionen direkt an der Rechnung.</p>
        </div>
        <Button onClick={() => setModal({ mode: "create" })}>Neu</Button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <Input
          placeholder="Suche nach Nummer oder Kunde"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="w-40"
        >
          <option value="all">Alle Status</option>
          <option value="open">Offen</option>
          <option value="sent">Gesendet</option>
          <option value="paid">Bezahlt</option>
        </Select>
        <Select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-48"
        >
          <option value="all">Alle Kategorien</option>
          {categories.map((c) => (
            <option key={c.id} value={c.label}>
              {c.label}
            </option>
          ))}
        </Select>
        <Button variant="secondary" onClick={load}>Aktualisieren</Button>
      </div>

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
        <div className="overflow-x-auto bg-white border border-slate-200 rounded-lg shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200 bg-slate-50">
                <th className="px-3 py-2">Nr.</th>
                <th className="px-3 py-2">Datum</th>
                <th className="px-3 py-2">Kunde</th>
                <th className="px-3 py-2">Kategorie</th>
                <th className="px-3 py-2">Betrag</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => {
                const st = computeStatus(inv);
                return (
                  <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 font-semibold">{inv.invoice_number}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {inv.date ? new Date(inv.date).toLocaleDateString() : "–"}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{inv.recipient_name || "–"}</td>
                  <td className="px-3 py-2 text-slate-600">{inv.category_label || "–"}</td>
                  <td className="px-3 py-2 text-slate-700">
                    {inv.gross_total != null ? `${inv.gross_total.toFixed(2)} €` : "–"}
                  </td>
                    <td className="px-3 py-2">
                      {st === "paid" ? (
                        <span className="text-green-700">Bezahlt</span>
                      ) : st === "sent" ? (
                        <span className="text-blue-700">Gesendet</span>
                      ) : (
                        <span className="text-amber-700">Offen</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right flex gap-2 justify-end">
                      <Button variant="secondary" onClick={() => openDetail(inv.id)}>
                        Öffnen
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => window.open(`/api/invoices/${inv.id}/pdf?mode=inline`, "_blank")}
                      >
                        PDF
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => onRegenerate(inv.id)}
                        disabled={busyId === inv.id}
                      >
                        {busyId === inv.id ? "…" : "PDF neu"}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          loadPreview(inv.id);
                          setDetail(null);
                        }}
                      >
                        Preview
                      </Button>
                      <Button variant="secondary" onClick={() => openSend(inv.id, inv.recipient_email || "")}>
                        Mail
                      </Button>
                      <Button variant="secondary" onClick={() => onDatevExport(inv.id)}>
                        DATEV
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {toast && <Alert type={toast.type === "success" ? "success" : "error"}>{toast.message}</Alert>}

      {modal && (
        <InvoiceFormModal
          mode={modal.mode}
          id={modal.id}
          onClose={() => setModal(null)}
          onSaved={(invNumber) => {
            setToast({ type: "success", message: `Rechnung ${invNumber} gespeichert.` });
            load();
          }}
          onError={(msg) => setToast({ type: "error", message: msg })}
        />
      )}

      {detail && (
        <InvoiceDetailModal
          detail={detail}
          onClose={() => setDetail(null)}
          onRegenerate={() => onRegenerate(detail.invoice.id)}
          onMarkSent={() => markAsSent(detail.invoice.id)}
          onMarkPaid={() => markAsPaid(detail.invoice.id)}
          onEmailPreview={() => loadPreview(detail.invoice.id)}
          onEmailSend={() => openSend(detail.invoice.id, detail.invoice.recipient.email || "")}
          onDatevExport={() => onDatevExport(detail.invoice.id)}
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
}: {
  mode: "create" | "edit";
  id?: number;
  onClose: () => void;
  onSaved: (invoiceNumber: string) => void;
  onError: (msg: string) => void;
}) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: "", quantity: 1, unit_price_gross: 0, vat_key: 1 },
  ]);
  const [form, setForm] = useState({
    recipient_id: "",
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
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBase = async () => {
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
        setForm((f) => ({ ...f, invoice_number: nextNr.next_number || f.invoice_number }));
      }
      if (mode === "edit" && id) {
        const data = await getInvoice(id);
        setForm({
          recipient_id: data.invoice.recipient.id ? String(data.invoice.recipient.id) : "",
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
        });
        setItems(
          data.items.map((i) => ({
            id: i.id,
            description: i.description,
            quantity: Number(i.quantity),
            unit_price_gross: Number(i.unit_price_gross),
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
  };

  useEffect(() => {
    loadBase();
  }, []);

  const selectRecipient = (idStr: string) => {
    setForm((f) => ({ ...f, recipient_id: idStr }));
    const idNum = Number(idStr);
    const found = customers.find((c) => c.id === idNum);
    if (found) {
      setForm((f) => ({
        ...f,
        name: found.name || "",
        street: found.street || "",
        zip: found.zip || "",
        city: found.city || "",
        email: found.email || "",
      }));
    }
  };

  const updateItem = (idx: number, field: keyof InvoiceItem, value: any) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  const addItem = () => setItems((prev) => [...prev, { description: "", quantity: 1, unit_price_gross: 0, vat_key: 1 }]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError("Empfängername ist erforderlich.");
      return;
    }
    if (!form.invoice_number.trim()) {
      setError("Rechnungsnummer fehlt.");
      return;
    }
    if (!form.date) {
      setError("Rechnungsdatum fehlt.");
      return;
    }
    if (!items.length) {
      setError("Mindestens eine Position ist erforderlich.");
      return;
    }
    if (items.some((i) => !i.description.trim() || Number(i.quantity) <= 0 || Number(i.unit_price_gross) <= 0)) {
      setError("Bitte alle Positionen ausfüllen (Beschreibung, Menge > 0, Preis > 0).");
      return;
    }
    if (form.b2b && !form.ust_id.trim()) {
      setError("Für B2B ist eine USt-ID erforderlich.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        recipient: {
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
        },
        items: items.map((i) => ({
          description: i.description.trim(),
          quantity: Number(i.quantity),
          unit_price_gross: Number(i.unit_price_gross),
          vat_key: Number(i.vat_key),
        })),
      };

      if (mode === "create") {
        const res = await createInvoice(payload);
        onSaved(payload.invoice.invoice_number);
        // Reset
        setItems([{ description: "", quantity: 1, unit_price_gross: 0, vat_key: 1 }]);
      } else if (id) {
        await updateInvoice(id, payload);
        onSaved(payload.invoice.invoice_number);
      }
      onClose();
    } catch (err: any) {
      const apiErr = err as ApiError;
      const msg = apiErr.message || "Rechnung konnte nicht gespeichert werden.";
      setError(msg);
      onError(msg);
      return;
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={mode === "create" ? "Neue Rechnung" : "Rechnung bearbeiten"} onClose={onClose}>
      {loading ? (
        <div className="flex items-center gap-2 text-slate-600">
          <Spinner /> Lade Daten ...
        </div>
      ) : (
        <form className="space-y-3" onSubmit={onSubmit}>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="text-sm text-slate-700">
              <span className="font-medium">Empfänger auswählen</span>
              <Select value={form.recipient_id} onChange={(e) => selectRecipient(e.target.value)}>
                <option value="">— Manuell erfassen —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm text-slate-700">
              <span className="font-medium">Rechnungsnummer</span>
              <Input
                value={form.invoice_number}
                onChange={(e) => setForm((f) => ({ ...f, invoice_number: e.target.value }))}
                required
              />
            </label>
            <label className="text-sm text-slate-700">
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
            <label className="text-sm text-slate-700">
              <span className="font-medium">Datum</span>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                required
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 mt-6">
              <input
                type="checkbox"
                checked={form.b2b}
                onChange={(e) => setForm((f) => ({ ...f, b2b: e.target.checked }))}
              />
              <span>B2B (USt-ID Pflicht)</span>
            </label>
            {form.b2b && (
              <label className="text-sm text-slate-700">
                <span className="font-medium">USt-ID</span>
                <Input
                  value={form.ust_id}
                  onChange={(e) => setForm((f) => ({ ...f, ust_id: e.target.value }))}
                />
              </label>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <label className="text-sm text-slate-700">
              <span className="font-medium">Name *</span>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </label>
            <label className="text-sm text-slate-700">
              <span className="font-medium">E-Mail</span>
              <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </label>
            <label className="text-sm text-slate-700">
              <span className="font-medium">Straße *</span>
              <Input value={form.street} onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))} />
            </label>
            <label className="text-sm text-slate-700">
              <span className="font-medium">PLZ *</span>
              <Input value={form.zip} onChange={(e) => setForm((f) => ({ ...f, zip: e.target.value }))} />
            </label>
            <label className="text-sm text-slate-700">
              <span className="font-medium">Ort *</span>
              <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
            </label>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Positionen</h4>
              <Button variant="secondary" type="button" onClick={addItem}>
                Position hinzufügen
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="grid md:grid-cols-4 gap-2 items-center border border-slate-200 rounded-md p-3">
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
                    onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))}
                  />
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_price_gross}
                    onChange={(e) => updateItem(idx, "unit_price_gross", Number(e.target.value))}
                  />
                  <select
                    className="input"
                    value={item.vat_key}
                    onChange={(e) => updateItem(idx, "vat_key", Number(e.target.value))}
                  >
                    <option value={1}>19% MwSt</option>
                    <option value={2}>7% MwSt</option>
                  </select>
                  <div className="flex justify-end">
                    {items.length > 1 && (
                      <Button variant="ghost" type="button" onClick={() => removeItem(idx)}>
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

function InvoiceDetailModal({
  detail,
  onClose,
  onRegenerate,
  onMarkSent,
  onMarkPaid,
  onEmailPreview,
  onEmailSend,
  onDatevExport,
}: {
  detail: InvoiceDetail;
  onClose: () => void;
  onRegenerate: () => void;
  onMarkSent: () => void;
  onMarkPaid: () => void;
  onEmailPreview: () => void;
  onEmailSend: () => void;
  onDatevExport: () => void;
}) {
  const inv = detail.invoice;
  return (
    <Modal title={`Rechnung ${inv.invoice_number}`} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between items-center">
          <div>
            <div className="font-semibold">{inv.recipient.name}</div>
            <div className="text-slate-600">
              {[inv.recipient.street, inv.recipient.zip, inv.recipient.city].filter(Boolean).join(" ")}
            </div>
          </div>
          <div className="space-x-2">
            <Button
              variant="secondary"
              onClick={() => window.open(`/api/invoices/${inv.id}/pdf?mode=inline`, "_blank")}
            >
              PDF
            </Button>
            <Button variant="secondary" onClick={onRegenerate}>
              PDF neu
            </Button>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-2">
          <div><span className="text-slate-500">Datum:</span> {inv.date ? new Date(inv.date).toLocaleDateString() : "–"}</div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Status:</span>
            {inv.status_paid_at ? (
              <Badge tone="green">Bezahlt</Badge>
            ) : inv.status_sent ? (
              <Badge tone="blue">Gesendet</Badge>
            ) : (
              <Badge tone="amber">Offen</Badge>
            )}
          </div>
          <div><span className="text-slate-500">Kategorie:</span> {inv.category || "–"}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onMarkSent}>Als gesendet markieren</Button>
          <Button variant="secondary" onClick={onMarkPaid}>Als bezahlt markieren</Button>
          <Button variant="secondary" onClick={onEmailPreview}>E-Mail Vorschau</Button>
          <Button variant="secondary" onClick={onEmailSend}>E-Mail senden</Button>
          <Button variant="secondary" onClick={onDatevExport}>DATEV Export</Button>
        </div>
        <div className="border border-slate-200 rounded-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left border-b border-slate-200">
                <th className="px-3 py-2">Beschreibung</th>
                <th className="px-3 py-2">Menge</th>
                <th className="px-3 py-2">Preis</th>
                <th className="px-3 py-2">MwSt</th>
              </tr>
            </thead>
            <tbody>
              {detail.items.map((it) => (
                <tr key={it.id} className="border-b border-slate-100">
                  <td className="px-3 py-2">{it.description}</td>
                  <td className="px-3 py-2">{Number(it.quantity).toLocaleString("de-DE")}</td>
                  <td className="px-3 py-2">{Number(it.unit_price_gross).toFixed(2)} €</td>
                  <td className="px-3 py-2">{it.vat_key === 2 ? "7%" : "19%"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-right font-semibold">
          Summe: {inv.gross_total != null ? `${Number(inv.gross_total).toFixed(2)} €` : "–"}
        </div>
      </div>
    </Modal>
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
  const [template, setTemplate] = useState<{ subject: string; body_html: string }>({
    subject: category?.template?.subject || "",
    body_html: category?.template?.body_html || "",
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
        if (tpl) setTemplate({ subject: tpl.subject || "", body_html: tpl.body_html || "" });
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
  }, []);

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
      if (template.subject && template.body_html) {
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
            placeholder="HTML Body"
            value={template.body_html}
            onChange={(e) => setTemplate((t) => ({ ...t, body_html: e.target.value }))}
            className="min-h-[120px]"
          />
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
  if (user?.role_name !== "admin") {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-4">
        Keine Berechtigung. Nur Admins können die Einstellungen bearbeiten.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">Einstellungen</h1>
        <p className="text-slate-700">
          SMTP- und Briefkopf-Einstellungen werden hier verwaltet. Änderungen gelten sofort für neue E-Mails/PDFs.
        </p>
      </div>
      <BankTaxSettingsForm />
      <DatevSettingsForm />
      <HkformsSettingsForm />
      <SmtpSettingsForm />
      <InvoiceHeaderForm />
      <ApiKeysSection />
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

function InvoiceHeaderForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<FormStatus>(null);
  const [form, setForm] = useState({
    company_name: "",
    address_line1: "",
    address_line2: "",
    zip: "",
    city: "",
    country: "",
    vat_id: "",
    bank_name: "",
    iban: "",
    bic: "",
    footer_text: "",
    logo_url: "",
  });

  useEffect(() => {
    setStatus(null);
    setLoading(true);
    getInvoiceHeader()
      .then((data) => {
        setForm({
          company_name: data.company_name || "",
          address_line1: data.address_line1 || "",
          address_line2: data.address_line2 || "",
          zip: data.zip || "",
          city: data.city || "",
          country: data.country || "",
          vat_id: data.vat_id || "",
          bank_name: data.bank_name || "",
          iban: data.iban || "",
          bic: data.bic || "",
          footer_text: data.footer_text || "",
          logo_url: data.logo_url || "",
        });
      })
      .catch((err: ApiError) =>
        setStatus({ type: "error", message: err.message || "Konnte Briefkopf nicht laden." })
      )
      .finally(() => setLoading(false));
  }, []);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      await updateInvoiceHeader(form);
      setStatus({ type: "success", message: "Briefkopf gespeichert." });
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
        <h2 className="text-xl font-semibold">Rechnungskopf / Briefkopf</h2>
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
        <Field label="Adresse Zeile 1">
          <input
            value={form.address_line1}
            onChange={(e) => setForm((f) => ({ ...f, address_line1: e.target.value }))}
            className="input"
          />
        </Field>
        <Field label="Adresse Zeile 2">
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
        <div className="hidden md:block" />
        <Field label="Bank">
          <input
            value={form.bank_name}
            onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))}
            className="input"
          />
        </Field>
        <Field label="IBAN">
          <input
            value={form.iban}
            onChange={(e) => setForm((f) => ({ ...f, iban: e.target.value }))}
            className="input"
          />
        </Field>
        <Field label="BIC">
          <input
            value={form.bic}
            onChange={(e) => setForm((f) => ({ ...f, bic: e.target.value }))}
            className="input"
          />
        </Field>
        <Field label="Logo URL (optional)">
          <input
            value={form.logo_url}
            onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))}
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

      <div className="overflow-x-auto">
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
        <div className="overflow-x-auto bg-white border border-slate-200 rounded-lg shadow-sm">
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
        <div className="overflow-x-auto bg-white border border-slate-200 rounded-lg shadow-sm">
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
  const [savingBank, setSavingBank] = useState(false);
  const [savingTax, setSavingTax] = useState(false);
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

  const saveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBank(true);
    setStatus(null);
    try {
      await updateBankSettings({
        account_holder: bank.account_holder,
        bank_name: bank.bank_name,
        iban: bank.iban,
        bic: bank.bic,
      });
      setStatus({ type: "success", message: "Bankdaten gespeichert." });
    } catch (err: any) {
      const apiErr = err as ApiError;
      setStatus({ type: "error", message: apiErr.message || "Bankdaten konnten nicht gespeichert werden." });
    } finally {
      setSavingBank(false);
    }
  };

  const saveTax = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTax(true);
    setStatus(null);
    try {
      await updateTaxSettings({
        tax_number: tax.tax_number || null,
        vat_id: tax.vat_id || null,
      });
      setStatus({ type: "success", message: "Steuerdaten gespeichert." });
    } catch (err: any) {
      const apiErr = err as ApiError;
      setStatus({ type: "error", message: apiErr.message || "Steuerdaten konnten nicht gespeichert werden." });
    } finally {
      setSavingTax(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Bank & Steuer</h2>
        {loading && <span className="text-sm text-slate-500">Lade ...</span>}
      </div>

      <form className="grid gap-3 md:grid-cols-2" onSubmit={saveBank}>
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
        <div className="md:col-span-2 flex justify-end">
          <Button type="submit" disabled={savingBank || loading}>
            {savingBank ? "Speichert ..." : "Bankdaten speichern"}
          </Button>
        </div>
      </form>

      <form className="grid gap-3 md:grid-cols-2" onSubmit={saveTax}>
        <Field label="Steuernummer">
          <Input value={tax.tax_number || ""} onChange={(e) => setTax((f) => ({ ...f, tax_number: e.target.value }))} />
        </Field>
        <Field label="USt-IdNr.">
          <Input value={tax.vat_id || ""} onChange={(e) => setTax((f) => ({ ...f, vat_id: e.target.value }))} />
        </Field>
        <div className="md:col-span-2 flex justify-end">
          <Button type="submit" disabled={savingTax || loading}>
            {savingTax ? "Speichert ..." : "Steuerdaten speichern"}
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
      .catch((err: ApiError) => setStatus({ type: "error", message: err.message || "HKForms konnte nicht geladen werden." }))
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
      setStatus({ type: "success", message: "HKForms-Einstellungen gespeichert." });
    } catch (err: any) {
      const apiErr = err as ApiError;
      setStatus({ type: "error", message: apiErr.message || "HKForms-Einstellungen konnten nicht gespeichert werden." });
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
        <h2 className="text-xl font-semibold">HKForms</h2>
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
  const [data, setData] = useState<InvoiceStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState<string>("");
  const [category, setCategory] = useState<string>("all");
  const [refreshFlag, setRefreshFlag] = useState(0);

  useEffect(() => {
    if (!canView) return;
    setLoading(true);
    setError(null);
    getInvoiceStats({
      year: year ? Number(year) : undefined,
      categories: category !== "all" ? [category] : undefined,
    })
      .then((res) => setData(res))
      .catch((err: ApiError) => {
        const msg = err.status === 403 ? "Keine Berechtigung für Statistiken." : err.message || "Stats konnten nicht geladen werden.";
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [canView, year, category, refreshFlag]);

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
        <Button variant="secondary" onClick={() => setRefreshFlag((v) => v + 1)}>
          Aktualisieren
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <Select value={year} onChange={(e) => setYear(e.target.value)} className="w-40">
          <option value="">Alle Jahre</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-48">
          <option value="all">Alle Kategorien</option>
          {data?.categories?.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label || c.key}
            </option>
          ))}
        </Select>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-600">
          <Spinner /> Lade Statistiken ...
        </div>
      )}
      {error && <Alert type="error">{error}</Alert>}

      {!loading && data && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <StatCard title="Summe (Gesamt)" value={formatEuro(data.overall.sum_total)} />
            <StatCard title="Bezahlt" value={formatEuro(data.overall.paid_sum)} />
            <StatCard title="Offen" value={formatEuro(data.overall.outstanding_sum)} />
            <StatCard title="Rechnungen gesamt" value={data.overall.count} />
            <StatCard title="Bezahlt (Anzahl)" value={data.overall.paid_count} />
            <StatCard title="Offen (Anzahl)" value={data.overall.unpaid_count} />
          </div>

          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-2">Jahr</th>
                  <th className="px-3 py-2">Summe</th>
                  <th className="px-3 py-2">Bezahlt</th>
                  <th className="px-3 py-2">Offen</th>
                  <th className="px-3 py-2">Anzahl</th>
                </tr>
              </thead>
              <tbody>
                {data.byYear.map((b) => (
                  <tr key={b.year} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-medium">{b.year}</td>
                    <td className="px-3 py-2">{formatEuro(b.sum_total)}</td>
                    <td className="px-3 py-2 text-green-700">{formatEuro(b.paid_sum)}</td>
                    <td className="px-3 py-2 text-amber-700">{formatEuro(b.outstanding_sum)}</td>
                    <td className="px-3 py-2">{b.count}</td>
                  </tr>
                ))}
                {!data.byYear.length && (
                  <tr>
                    <td colSpan={5} className="px-3 py-3 text-center text-slate-500">
                      Keine Daten vorhanden.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
