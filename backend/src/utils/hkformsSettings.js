import { db } from "./db.js";

const DEFAULT_BASE_URL = "https://app.bistrottelegraph.de/api";
const CACHE_MS = 2 * 60 * 1000;

const normalizeBaseUrl = (value) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";
  return trimmed.replace(/\/+$/, "");
};

const normalizeOrganization = (value) => (value || "").trim();
const normalizeApiKey = (value) => (value || "").trim();

const buildFallbackSettings = () => ({
  base_url: normalizeBaseUrl(process.env.HKFORMS_BASE_URL || DEFAULT_BASE_URL) || DEFAULT_BASE_URL,
  organization: normalizeOrganization(process.env.HKFORMS_ORGANIZATION || ""),
  api_key: normalizeApiKey(process.env.HKFORMS_SYNC_TOKEN || ""),
});

let cachedSettings = null;
let cachedAt = 0;

async function ensureHkformsSettingsTable(fallback = buildFallbackSettings()) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS hkforms_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      base_url TEXT NOT NULL,
      organization TEXT,
      api_key TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.query(
    `
      INSERT INTO hkforms_settings (id, base_url, organization, api_key)
      VALUES (1, $1, $2, $3)
      ON CONFLICT (id) DO NOTHING
    `,
    [
      fallback.base_url || DEFAULT_BASE_URL,
      fallback.organization || null,
      null,
    ]
  );
}

export async function getHkformsSettings(options = {}) {
  const forceRefresh = options.forceRefresh || false;
  const now = Date.now();
  const fallbackSettings = buildFallbackSettings();
  const envChangedWhileCached =
    cachedSettings &&
    cachedSettings.source === "env" &&
    (
      cachedSettings.base_url !== fallbackSettings.base_url ||
      cachedSettings.organization !== fallbackSettings.organization ||
      cachedSettings.api_key !== fallbackSettings.api_key
    );

  if (!forceRefresh && cachedSettings && now - cachedAt < CACHE_MS && !envChangedWhileCached) {
    return cachedSettings;
  }

  try {
    await ensureHkformsSettingsTable(fallbackSettings);
    const result = await db.query(
      "SELECT base_url, organization, api_key FROM hkforms_settings WHERE id = 1"
    );

    const row = result.rows?.[0] || {};
    const base_url = normalizeBaseUrl(row.base_url || fallbackSettings.base_url || DEFAULT_BASE_URL) || DEFAULT_BASE_URL;
    const organization = normalizeOrganization(
      row.organization !== undefined && row.organization !== null
        ? row.organization
        : fallbackSettings.organization
    );
    const api_key = normalizeApiKey(
      row.api_key !== undefined && row.api_key !== null
        ? row.api_key
        : fallbackSettings.api_key
    );
    const hasDbToken = row.api_key !== undefined && row.api_key !== null && row.api_key !== "";
    const hasDbOrg = row.organization !== undefined && row.organization !== null && row.organization !== "";

    cachedSettings = {
      base_url,
      organization,
      api_key,
      source: hasDbToken || hasDbOrg
        ? "db"
        : fallbackSettings.api_key || fallbackSettings.organization
          ? "env"
          : "default",
    };
    cachedAt = now;
  } catch (err) {
    console.warn("[hkforms] Einstellungen laden fehlgeschlagen, nutze Fallback.", err?.message || err);
    cachedSettings = {
      ...fallbackSettings,
      base_url: normalizeBaseUrl(fallbackSettings.base_url || DEFAULT_BASE_URL) || DEFAULT_BASE_URL,
      source: fallbackSettings.api_key || fallbackSettings.organization ? "env" : "default",
    };
    cachedAt = Date.now();
  }

  return cachedSettings;
}

export async function saveHkformsSettings(payload = {}) {
  const baseUrl = normalizeBaseUrl(payload.base_url);
  const organization = normalizeOrganization(payload.organization);
  const apiKey = normalizeApiKey(payload.api_key);

  const errors = [];
  if (!baseUrl) errors.push("API Basis-URL darf nicht leer sein.");
  if (baseUrl && !/^https?:\/\//i.test(baseUrl)) errors.push("API Basis-URL muss mit http:// oder https:// beginnen.");
  if (!apiKey) errors.push("API-Schlüssel darf nicht leer sein.");

  if (errors.length) {
    const err = new Error(errors.join(" "));
    err.userMessage = errors.join(" ");
    err.statusCode = 400;
    throw err;
  }

  try {
    const fallbackSettings = buildFallbackSettings();
    await ensureHkformsSettingsTable(fallbackSettings);
    const result = await db.query(
      `
        INSERT INTO hkforms_settings (id, base_url, organization, api_key, updated_at)
        VALUES (1, $1, $2, $3, NOW())
        ON CONFLICT (id) DO UPDATE SET
          base_url = EXCLUDED.base_url,
          organization = EXCLUDED.organization,
          api_key = EXCLUDED.api_key,
          updated_at = NOW()
        RETURNING base_url, organization, api_key
      `,
      [baseUrl, organization || null, apiKey]
    );

    const row = result.rows?.[0] || {};
    cachedSettings = {
      base_url: normalizeBaseUrl(row.base_url || baseUrl) || DEFAULT_BASE_URL,
      organization: normalizeOrganization(row.organization ?? organization),
      api_key: normalizeApiKey(row.api_key ?? apiKey),
      source: "db",
    };
    cachedAt = Date.now();

    return cachedSettings;
  } catch (err) {
    if (err?.code === "42P01") {
      await ensureHkformsSettingsTable();
      return saveHkformsSettings(payload);
    }
    throw err;
  }
}

export function resetHkformsSettingsCache() {
  cachedSettings = null;
  cachedAt = 0;
}
