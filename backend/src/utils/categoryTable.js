import { db } from "./db.js";

let tableReady = false;
let inflightPromise = null;

export async function ensureInvoiceCategoriesTable() {
  if (tableReady) return;
  if (inflightPromise) return inflightPromise;

  inflightPromise = (async () => {
    // Prüfe über to_regclass() innerhalb des aktuellen search_path (app, public)
    const existsResult = await db.query(`SELECT to_regclass('invoice_categories') AS reg`);
    const tableExists = Boolean(existsResult.rows[0]?.reg);

    if (!tableExists) {
      // Falls Tabelle fehlt, nur versuchen anzulegen. Scheitert bei fehlender CREATE-Berechtigung -> Fehler wird hochgereicht.
      await db.query(`
        CREATE TABLE IF NOT EXISTS invoice_categories (
          id SERIAL PRIMARY KEY,
          key VARCHAR(100) UNIQUE NOT NULL,
          label VARCHAR(255) NOT NULL,
          logo_file VARCHAR(255),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Index nur anlegen, wenn wir die Tabelle selbst erstellt haben
      await db.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_categories_key
        ON invoice_categories (key)
      `);
    }

    tableReady = true;
  })().catch((err) => {
    inflightPromise = null;
    throw err;
  });

  return inflightPromise;
}
