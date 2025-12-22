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
    () => [
      "Rechnungen",
      "Kunden",
      "Kategorien",
      "Rollen & Benutzer",
      "Statistiken",
      "Einstellungen",
    ],
    []
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
        <p className="text-slate-700">
          Du bist eingeloggt. Nicht migrierte Bereiche sind vorübergehend als Platzhalter markiert.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((title) => (
          <PlaceholderCard key={title} title={title} />
        ))}
      </div>
      {isAdmin && (
        <div className="mt-2 space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-900">
            Admin: Einstellungen findest du unter <Link className="underline" to="/settings">/settings</Link>.
          </div>
          <RegeneratePdfCard />
        </div>
      )}
    </div>
  );
}

function PlaceholderCard({ title }: { title: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
      <h2 className="font-semibold mb-2">{title}</h2>
      <p className="text-sm text-slate-600">Noch nicht migriert. Funktionalität folgt in der neuen SPA.</p>
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
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Rechnungen</h1>
      </div>
      <EmptyState title="Rechnungen" description="Funktionalität folgt. PDF-Neuerstellung im Admin-Bereich möglich." />
    </div>
  );
}

function RegeneratePdfCard() {
  const [invoiceId, setInvoiceId] = useState("");
  const [status, setStatus] = useState<FormStatus>(null);
  const [busy, setBusy] = useState(false);

  const onRegenerate = async () => {
    const id = Number(invoiceId);
    if (!id) {
      setStatus({ type: "error", message: "Bitte eine gültige Rechnungs-ID angeben." });
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const res = await regenerateInvoicePdf(id);
      setStatus({
        type: "success",
        message: `PDF neu erstellt (${res.filename})${res.size ? `, Größe ${res.size} Bytes` : ""}.`,
      });
    } catch (err: any) {
      const apiErr = err as ApiError;
      setStatus({ type: "error", message: apiErr.message || "PDF konnte nicht neu erstellt werden." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
      <h3 className="font-semibold mb-2">PDF neu erstellen (Admin)</h3>
      <p className="text-sm text-slate-600 mb-3">
        Falls Briefkopf geändert wurde oder das PDF veraltet ist, kannst du es hier neu erzeugen.
      </p>
      <div className="flex items-center gap-3 flex-wrap">
        <input
          className="input w-40"
          placeholder="Rechnungs-ID"
          value={invoiceId}
          onChange={(e) => setInvoiceId(e.target.value)}
          inputMode="numeric"
        />
        <button className="btn-secondary" onClick={onRegenerate} disabled={busy}>
          {busy ? "Erzeuge ..." : "PDF neu erstellen"}
        </button>
      </div>
      {status && (
        <Alert type={status.type === "success" ? "success" : "error"}>{status.message}</Alert>
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
      await refresh();
    } catch (err: any) {
      const apiErr = err as ApiError;
      setStatus({ type: "error", message: apiErr.message || "Speichern fehlgeschlagen." });
    } finally {
      setSaving(false);
    }
  };

  const onTest = async () => {
    if (!testRecipient.trim()) {
      setStatus({ type: "error", message: "Bitte Empfänger für Testmail angeben." });
      return;
    }
    setTesting(true);
    setStatus(null);
    try {
      const res = await testSmtp(testRecipient.trim());
      const msg = res.message || (res.dry_run ? "Dry-Run erfolgreich." : "Testmail gesendet.");
      setStatus({
        type: "success",
        message: `${msg} Empfänger: ${res.to}${res.redirected ? " (redirected)" : ""}${
          res.dry_run ? " | Versand deaktiviert (EMAIL_SEND_DISABLED=1)" : ""
        }`,
      });
    } catch (err: any) {
      const apiErr = err as ApiError;
      setStatus({ type: "error", message: apiErr.message || "Test fehlgeschlagen." });
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
        <Field label="Passwort (write-only)">
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className="input"
            placeholder={form.has_password ? "******** (gesetzt)" : "Noch nicht gesetzt"}
          />
          <p className="text-xs text-slate-500 mt-1">
            Passwort wird nur gesendet, wenn du es hier eingibst. Aktueller Status:{" "}
            {form.has_password ? "gesetzt" : "nicht gesetzt"}.
          </p>
        </Field>
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
              : "bg-red-50 text-red-700 border border-red-100"
          }`}
        >
          {status.message}
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
