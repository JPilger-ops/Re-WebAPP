import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  ApiError,
  AuthUser,
  ApiKeyInfo,
  Customer,
  getInvoiceHeader,
  getSmtpSettings,
  login as apiLogin,
  testSmtp,
  updateInvoiceHeader,
  updateSmtpSettings,
  regenerateInvoicePdf,
  listApiKeys,
  createApiKey,
  rotateApiKey,
  revokeApiKey,
  listCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "./api";
import { AuthProvider, useAuth } from "./AuthProvider";
import { Alert, Button, Checkbox, Confirm, EmptyState, Input, Modal, Spinner, Textarea } from "./ui";

type FormStatus = { type: "success" | "error"; message: string } | null;

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/settings" element={<AdminSettings />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
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

  return <Shell />;
}

function Shell() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role_name === "admin";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const links = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/customers", label: "Kunden" },
    { to: "/invoices", label: "Rechnungen" },
    ...(isAdmin ? [{ to: "/settings", label: "Einstellungen" }] : []),
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
              <NavLink key={l.to} href={l.to} label={l.label} />
            ))}
          </nav>
        </aside>
        <main className="flex-1 min-w-0">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/settings" element={<AdminSettings />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  const location = useLocation();
  const active = location.pathname === href;
  return (
    <a
      href={href}
      className={`px-2 py-1 rounded-md text-sm ${
        active ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-100"
      }`}
    >
      {label}
    </a>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role_name === "admin";

  const cards = useMemo(
    () => ["Rechnungen", "Kunden", "Einstellungen"],
    [],
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
            to={title === "Rechnungen" ? "/invoices" : title === "Kunden" ? "/customers" : "/settings"}
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

function Invoices() {
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [filtered, setFiltered] = useState<InvoiceListItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "sent" | "paid">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: "create" | "edit"; id?: number } | null>(null);
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [toast, setToast] = useState<FormStatus>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const computeStatus = (inv: InvoiceListItem) => {
    if (inv.status_paid_at) return "paid";
    if (inv.status_sent) return "sent";
    return "open";
  };

  const applyFilter = (list: InvoiceListItem[], term: string, status: typeof statusFilter) => {
    const t = term.toLowerCase();
    return list.filter((inv) => {
      const matchesTerm =
        !t ||
        inv.invoice_number.toLowerCase().includes(t) ||
        (inv.recipient_name || "").toLowerCase().includes(t);
      const st = computeStatus(inv);
      const matchesStatus = status === "all" || st === status;
      return matchesTerm && matchesStatus;
    });
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listInvoices();
      setInvoices(res);
      setFiltered(applyFilter(res, search, statusFilter));
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
    setFiltered(applyFilter(invoices, search, statusFilter));
  }, [invoices, search, statusFilter]);

  const openDetail = async (id: number) => {
    try {
      const data = await getInvoice(id);
      setDetail(data);
    } catch (err: any) {
      const apiErr = err as ApiError;
      setToast({ type: "error", message: apiErr.message || "Rechnung konnte nicht geladen werden." });
    }
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
        />
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
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBase = async () => {
    setLoading(true);
    setError(null);
    try {
      const [custs, nextNr] = await Promise.all([
        listCustomers(),
        mode === "create" ? getNextInvoiceNumber() : Promise.resolve({ next_number: "" }),
      ]);
      setCustomers(custs);
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
          category: null,
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
}: {
  detail: InvoiceDetail;
  onClose: () => void;
  onRegenerate: () => void;
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
          <div><span className="text-slate-500">Status:</span> {inv.status_paid_at ? "Bezahlt" : inv.status_sent ? "Gesendet" : "Offen"}</div>
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
