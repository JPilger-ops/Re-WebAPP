import { db } from "./db.js";

export const DATEV_STATUS = {
  NOT_SENT: "NOT_SENT",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED",
};

let columnsReady = false;
let inflightPromise = null;

const n = (value) => Number(value) || 0;
const formatDateDe = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  return isNaN(d) ? "-" : d.toLocaleDateString("de-DE");
};

export const buildDatevMailSubject = (invoiceNumber) =>
  `Rechnung ${invoiceNumber} – DATEV Export`;

export function buildDatevMailBody(row = {}, bankSettings = {}) {
  const recipient = row.recipient_name || row.recipient || "Kunde";
  const invoiceDate = formatDateDe(row.date);
  const amountValue = row.b2b ? n(row.net_19) + n(row.net_7) : n(row.gross_total);
  const amountDisplay = amountValue.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const bankLine = bankSettings.bank_name
    ? `${bankSettings.bank_name} · IBAN ${bankSettings.iban || "-"}`
    : "";

  const category = row.category_label || row.category_key || row.category || "-";

  return [
    `Rechnung ${row.invoice_number} für ${recipient}`,
    "",
    `Rechnungsdatum: ${invoiceDate}`,
    `Betrag: ${amountDisplay} EUR`,
    `Kategorie: ${category}`,
    bankLine ? `Bank: ${bankLine}` : null,
    "",
    "Die Rechnung ist als PDF angehängt und für den DATEV-Import vorgesehen.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildDatevRecipients(customerEmail, datevEmail, includeDatev) {
  const to = (customerEmail || "").trim();
  const datev = (datevEmail || "").trim();

  const recipients = { to, includeDatev: false };

  if (includeDatev && datev) {
    recipients.bcc = datev;
    recipients.includeDatev = true;
  }

  return recipients;
}

export async function ensureDatevExportColumns() {
  if (columnsReady) return;
  if (inflightPromise) return inflightPromise;

  inflightPromise = (async () => {
    await db.query(`
      ALTER TABLE invoices
        ADD COLUMN IF NOT EXISTS datev_export_status VARCHAR(20) DEFAULT 'NOT_SENT',
        ADD COLUMN IF NOT EXISTS datev_exported_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS datev_export_error TEXT
    `);

    await db.query(`
      ALTER TABLE invoices
        ALTER COLUMN datev_export_status SET DEFAULT 'NOT_SENT'
    `);

    await db.query(`
      UPDATE invoices
      SET datev_export_status = 'NOT_SENT'
      WHERE datev_export_status IS NULL
    `);

    columnsReady = true;
  })().catch((err) => {
    inflightPromise = null;
    throw err;
  });

  return inflightPromise;
}

export async function updateDatevExportStatus(invoiceId, status, errorText = null) {
  await ensureDatevExportColumns();
  const sanitizedStatus = Object.values(DATEV_STATUS).includes(status) ? status : DATEV_STATUS.FAILED;

  await db.query(
    `
      UPDATE invoices
      SET
        datev_export_status = $1::varchar(20),
        datev_export_error = $2,
        datev_exported_at = CASE WHEN $1::varchar(20) = 'SUCCESS' THEN NOW() ELSE datev_exported_at END
      WHERE id = $3
    `,
    [sanitizedStatus, errorText || null, invoiceId]
  );
}
