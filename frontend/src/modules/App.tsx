import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  ApiError,
  AuthUser,
  getInvoiceHeader,
  getSmtpSettings,
  login as apiLogin,
  testSmtp,
  updateInvoiceHeader,
  updateSmtpSettings,
} from "./api";
import { AuthProvider, useAuth } from "./AuthProvider";

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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="font-semibold">RechnungsAPP</div>
          <div className="flex items-center gap-4 text-sm">
            <nav className="flex items-center gap-3">
              <NavLink href="/dashboard" label="Dashboard" />
              {isAdmin && <NavLink href="/settings" label="Einstellungen" />}
            </nav>
            <span className="text-slate-600">Eingeloggt als {user?.username}</span>
            <button
              onClick={logout}
              className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-100 transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings" element={<AdminSettings />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
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
    <div>
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <p className="text-slate-700 mb-6">
        Du bist eingeloggt. Nicht migrierte Bereiche sind vorübergehend als Platzhalter markiert.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((title) => (
          <PlaceholderCard key={title} title={title} />
        ))}
      </div>
      {isAdmin && (
        <div className="mt-8 p-4 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-900">
          Admin: Einstellungen findest du unter <a className="underline" href="/settings">/settings</a>.
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
