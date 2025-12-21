import { FormEvent, useEffect, useState } from "react";
import { login, logout, me, ApiError } from "./api";

export function App() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [user, setUser] = useState<{ username: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    me()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus(null);
    try {
      await login(username, password);
      const user = await me();
      setUser(user);
      setStatus(null);
    } catch (err: any) {
      const apiErr = err as ApiError;
      setStatus(apiErr.message || "Login fehlgeschlagen");
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      setUser(null);
      setStatus(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-700">Lade Session ...</div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <header className="bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="font-semibold">RechnungsAPP</div>
            <div className="flex items-center gap-3 text-sm">
              <span>Eingeloggt als {user.username}</span>
              <button
                onClick={handleLogout}
                className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-100 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
          <p className="text-slate-700 mb-6">
            Du bist eingeloggt. Nicht migrierte Bereiche sind vorübergehend als Platzhalter markiert.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <PlaceholderCard title="Rechnungen" />
            <PlaceholderCard title="Kunden" />
            <PlaceholderCard title="Kategorien" />
            <PlaceholderCard title="Rollen & Benutzer" />
            <PlaceholderCard title="Statistiken" />
            <PlaceholderCard title="Einstellungen" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
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
            className="w-full rounded-md bg-blue-600 text-white py-2 font-semibold hover:bg-blue-700 transition"
          >
            Einloggen
          </button>
        </form>
        {status && <p className="mt-4 text-sm text-red-600">{status}</p>}
      </div>
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
