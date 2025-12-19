import { db } from "./db.js";

const CACHE_MS = 2 * 60 * 1000;

const normalize = (value) => (value || "").trim();

const buildFallbackSettings = () => ({
  tax_number: normalize(process.env.TAX_NUMBER || ""),
  vat_id: normalize(process.env.VAT_ID || ""),
});

let cachedSettings = null;
let cachedAt = 0;

async function ensureTaxSettingsTable(fallback = buildFallbackSettings()) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS tax_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      tax_number TEXT,
      vat_id TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.query(
    `
      INSERT INTO tax_settings (id, tax_number, vat_id)
      VALUES (1, $1, $2)
      ON CONFLICT (id) DO NOTHING
    `,
    [fallback.tax_number || null, fallback.vat_id || null]
  );
}

export async function getTaxSettings(options = {}) {
  const now = Date.now();
  const forceRefresh = options.forceRefresh || false;
  const fallbackSettings = buildFallbackSettings();

  if (!forceRefresh && cachedSettings && now - cachedAt < CACHE_MS) {
    return cachedSettings;
  }

  try {
    await ensureTaxSettingsTable(fallbackSettings);
    const result = await db.query(
      "SELECT tax_number, vat_id FROM tax_settings WHERE id = 1"
    );

    const row = result.rows?.[0] || {};
    const tax_number = normalize(
      row.tax_number !== undefined && row.tax_number !== null ? row.tax_number : fallbackSettings.tax_number
    );
    const vat_id = normalize(
      row.vat_id !== undefined && row.vat_id !== null ? row.vat_id : fallbackSettings.vat_id
    );

    const hasDbValues =
      (row.tax_number !== undefined && row.tax_number !== null) ||
      (row.vat_id !== undefined && row.vat_id !== null);

    cachedSettings = {
      tax_number,
      vat_id,
      source: hasDbValues ? "db" : fallbackSettings.tax_number || fallbackSettings.vat_id ? "env" : "none",
    };
    cachedAt = now;
  } catch (err) {
    console.warn("[tax] Einstellungen laden fehlgeschlagen, nutze Fallback.", err?.message || err);
    cachedSettings = {
      ...fallbackSettings,
      source: fallbackSettings.tax_number || fallbackSettings.vat_id ? "env" : "none",
    };
    cachedAt = Date.now();
  }

  return cachedSettings;
}

export async function saveTaxSettings(payload = {}) {
  const tax_number = normalize(payload.tax_number);
  const vat_id = normalize(payload.vat_id);

  if (!tax_number && !vat_id) {
    const err = new Error("Steuer-Nr. oder USt-IdNr. angeben.");
    err.userMessage = err.message;
    err.statusCode = 400;
    throw err;
  }

  try {
    const fallbackSettings = buildFallbackSettings();
    await ensureTaxSettingsTable(fallbackSettings);
    const result = await db.query(
      `
        INSERT INTO tax_settings (id, tax_number, vat_id, updated_at)
        VALUES (1, $1, $2, NOW())
        ON CONFLICT (id) DO UPDATE SET
          tax_number = EXCLUDED.tax_number,
          vat_id = EXCLUDED.vat_id,
          updated_at = NOW()
        RETURNING tax_number, vat_id
      `,
      [tax_number || null, vat_id || null]
    );

    const row = result.rows?.[0] || {};
    cachedSettings = {
      tax_number: normalize(row.tax_number ?? tax_number),
      vat_id: normalize(row.vat_id ?? vat_id),
      source: "db",
    };
    cachedAt = Date.now();

    return cachedSettings;
  } catch (err) {
    if (err?.code === "42P01") {
      await ensureTaxSettingsTable();
      return saveTaxSettings(payload);
    }
    throw err;
  }
}

export function resetTaxSettingsCache() {
  cachedSettings = null;
  cachedAt = 0;
}
