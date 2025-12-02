import { db } from "./db.js";

const fallbackBankSettings = {
  account_holder: process.env.SEPA_CREDITOR_NAME || "Waldwirtschaft Heidekönig",
  bank_name: process.env.BANK_NAME || "VR-Bank Bonn Rhein-Sieg eG",
  iban: (process.env.SEPA_CREDITOR_IBAN || "DE48 3706 9520 1104 1850 25").replace(/\s+/g, ""),
  bic: (process.env.SEPA_CREDITOR_BIC || "GENODED1RST").replace(/\s+/g, "").toUpperCase(),
};

let cachedBankSettings = null;
let cachedAt = 0;
const CACHE_MS = 2 * 60 * 1000; // 2 Minuten Cache reichen für wiederholte Zugriffe

async function ensureBankSettingsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS bank_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      account_holder TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      iban TEXT NOT NULL,
      bic TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.query(
    `
      INSERT INTO bank_settings (id, account_holder, bank_name, iban, bic)
      VALUES (1, $1, $2, $3, $4)
      ON CONFLICT (id) DO NOTHING
    `,
    [
      fallbackBankSettings.account_holder,
      fallbackBankSettings.bank_name,
      fallbackBankSettings.iban,
      fallbackBankSettings.bic,
    ]
  );
}

export async function getBankSettings(options = {}) {
  const force = options.forceRefresh || false;
  const now = Date.now();

  if (!force && cachedBankSettings && now - cachedAt < CACHE_MS) {
    return cachedBankSettings;
  }

  try {
    const result = await db.query(
      "SELECT account_holder, bank_name, iban, bic FROM bank_settings WHERE id = 1"
    );

    const fromDb = result.rows[0] || {};
    cachedBankSettings = {
      ...fallbackBankSettings,
      ...fromDb,
      iban: (fromDb.iban || fallbackBankSettings.iban || "").replace(/\s+/g, "").toUpperCase(),
      bic: (fromDb.bic || fallbackBankSettings.bic || "").replace(/\s+/g, "").toUpperCase(),
    };
    cachedAt = now;
  } catch (err) {
    if (err?.code === "42P01") {
      // Tabelle fehlt -> anlegen und einmalig erneut versuchen
      await ensureBankSettingsTable();
      return getBankSettings({ forceRefresh: true });
    }
    console.error("Bankdaten konnten nicht aus der Datenbank geladen werden, nutze Fallback.", err);
    cachedBankSettings = { ...fallbackBankSettings };
    cachedAt = now;
  }

  return cachedBankSettings;
}

export async function saveBankSettings(payload) {
  const account_holder = (payload.account_holder || "").trim();
  const bank_name = (payload.bank_name || "").trim();
  const iban = (payload.iban || "").replace(/\s+/g, "").toUpperCase();
  const bic = (payload.bic || "").replace(/\s+/g, "").toUpperCase();

  try {
    const result = await db.query(
      `
        INSERT INTO bank_settings (id, account_holder, bank_name, iban, bic, updated_at)
        VALUES (1, $1, $2, $3, $4, NOW())
        ON CONFLICT (id) DO UPDATE SET
          account_holder = EXCLUDED.account_holder,
          bank_name = EXCLUDED.bank_name,
          iban = EXCLUDED.iban,
          bic = EXCLUDED.bic,
          updated_at = NOW()
        RETURNING account_holder, bank_name, iban, bic
      `,
      [account_holder, bank_name, iban, bic]
    );

    cachedBankSettings = result.rows[0];
    cachedAt = Date.now();

    return cachedBankSettings;
  } catch (err) {
    if (err?.code === "42P01") {
      await ensureBankSettingsTable();
      return saveBankSettings(payload);
    }
    throw err;
  }
}
