import { db } from "./db.js";

const fallbackEmail = (process.env.DATEV_EMAIL || "").trim();
const CACHE_MS = 2 * 60 * 1000;

let cachedSettings = null;
let cachedAt = 0;

export const isValidEmail = (value) => {
  const email = (value || "").trim();
  if (!email) return false;
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
};

async function ensureDatevSettingsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS datev_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      email TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.query(
    `
      INSERT INTO datev_settings (id, email)
      VALUES (1, $1)
      ON CONFLICT (id) DO NOTHING
    `,
    [fallbackEmail || null]
  );
}

export async function getDatevSettings(options = {}) {
  const forceRefresh = options.forceRefresh || false;
  const now = Date.now();

  if (!forceRefresh && cachedSettings && now - cachedAt < CACHE_MS) {
    return cachedSettings;
  }

  try {
    await ensureDatevSettingsTable();
    const result = await db.query(
      "SELECT email FROM datev_settings WHERE id = 1"
    );

    const row = result.rows[0] || {};
    const emailFromDb = (row.email || "").trim();
    const resolvedEmail = emailFromDb || fallbackEmail || "";

    cachedSettings = {
      email: resolvedEmail,
      configured: Boolean(emailFromDb),
      source: emailFromDb ? "db" : fallbackEmail ? "env" : "none",
    };
    cachedAt = now;
  } catch (err) {
    if (err?.code === "42P01") {
      // Tabelle fehlt → einmalig anlegen
      await ensureDatevSettingsTable();
      return getDatevSettings({ forceRefresh: true });
    }
    console.error("DATEV-Einstellungen konnten nicht geladen werden, nutze Fallback.", err);
    cachedSettings = {
      email: fallbackEmail || "",
      configured: Boolean(fallbackEmail),
      source: fallbackEmail ? "env" : "none",
    };
    cachedAt = now;
  }

  return cachedSettings;
}

export async function saveDatevSettings(payload) {
  const email = (payload.email || "").trim();

  if (!isValidEmail(email)) {
    const err = new Error("DATEV-E-Mail ist ungültig.");
    err.userMessage = "Bitte eine gültige DATEV-E-Mail-Adresse hinterlegen.";
    throw err;
  }

  try {
    await ensureDatevSettingsTable();
    const result = await db.query(
      `
        INSERT INTO datev_settings (id, email, updated_at)
        VALUES (1, $1, NOW())
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          updated_at = NOW()
        RETURNING email, updated_at
      `,
      [email]
    );

    cachedSettings = {
      email: result.rows[0].email,
      configured: true,
      source: "db",
    };
    cachedAt = Date.now();

    return cachedSettings;
  } catch (err) {
    if (err?.code === "42P01") {
      await ensureDatevSettingsTable();
      return saveDatevSettings(payload);
    }
    throw err;
  }
}

// Nur für Tests, damit der Cache nicht zwischen Tests hängt
export function resetDatevSettingsCache() {
  cachedSettings = null;
  cachedAt = 0;
}
