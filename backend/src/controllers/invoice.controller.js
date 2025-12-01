import { db } from "../utils/db.js";
import puppeteer from "puppeteer";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

function normalizeEpcText(text) {
  return text
    .normalize("NFD")                      // diakritische Zeichen entfernen
    .replace(/[\u0300-\u036f]/g, "")       // weitere Unicode-Diacritics löschen
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .replace(/[^\w\s\-.,/]/g, "")          // alles was nicht EPC erlaubt ist
    .trim();
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//--- SEPA QR-Code ---
const {
  SEPA_CREDITOR_NAME,
  SEPA_CREDITOR_IBAN,
  SEPA_CREDITOR_BIC
} = process.env;

// 🔹 Standard-Logo (Fallback, wenn Kategorie kein eigenes Logo hat)
const defaultLogoPath = path.join(__dirname, "../../public/logos/HK_LOGO.png");

let defaultLogoBase64 = "";
try {
  defaultLogoBase64 = fs.readFileSync(defaultLogoPath, "base64");
  console.log("Standard-Logo erfolgreich geladen:", defaultLogoPath);
} catch (err) {
  console.error("Standard-Logo konnte NICHT geladen werden:", defaultLogoPath, err);
}

const n = (value) => Number(value) || 0;

function calculateTotals(items) {
  let net_19 = 0, vat_19 = 0, gross_19 = 0;
  let net_7 = 0,  vat_7 = 0,  gross_7 = 0;

  for (const item of items) {
    const gross = n(item.quantity) * n(item.unit_price_gross);
    const vatRate = item.vat_key === 1 ? 0.19 : 0.07;
    const net = gross / (1 + vatRate);
    const vat = gross - net;

    if (item.vat_key === 1) {
      net_19 += net;
      vat_19 += vat;
      gross_19 += gross;
    } else {
      net_7 += net;
      vat_7 += vat;
      gross_7 += gross;
    }
  }

  return {
    net_19,
    vat_19,
    gross_19,
    net_7,
    vat_7,
    gross_7,
    gross_total: gross_19 + gross_7
  };
}

/**
 * POST /api/invoices
 * Erstellt eine komplette Rechnung + Empfänger + Positionen
 */
export const createInvoice = async (req, res) => {
  const { recipient, invoice, items } = req.body;

  // ---------------------------------------------------------
// 🔍 DETAILLIERTE VALIDIERUNG ALLER FELDER
// ---------------------------------------------------------

// --- Empfänger prüfen ---
if (!recipient) {
  return res.status(400).json({ message: "Empfängerdaten fehlen." });
}

if (!recipient.name || recipient.name.trim() === "") {
  return res.status(400).json({ message: "Empfängername fehlt." });
}

if (!recipient.street || recipient.street.trim() === "") {
  return res.status(400).json({ message: "Straße fehlt." });
}

if (!recipient.zip || recipient.zip.trim() === "") {
  return res.status(400).json({ message: "PLZ fehlt." });
}

if (!recipient.city || recipient.city.trim() === "") {
  return res.status(400).json({ message: "Ort fehlt." });
}


// --- Rechnungsdaten prüfen ---
if (!invoice) {
  return res.status(400).json({ message: "Rechnungsdaten fehlen." });
}

if (!invoice.invoice_number || invoice.invoice_number.toString().trim() === "") {
  return res.status(400).json({ message: "Rechnungsnummer fehlt." });
}

if (!invoice.date || invoice.date.trim() === "") {
  return res.status(400).json({ message: "Rechnungsdatum fehlt." });
}

// B2B → USt-ID Pflicht
if (invoice.b2b) {
  if (!invoice.ust_id || invoice.ust_id.trim() === "") {
    return res.status(400).json({ message: "Für B2B ist eine USt-ID erforderlich." });
  }
}

// --- Positionen prüfen ---
if (!Array.isArray(items) || items.length === 0) {
  return res.status(400).json({ message: "Mindestens eine Rechnungsposition ist erforderlich." });
}

for (let i = 0; i < items.length; i++) {
  const item = items[i];

  if (!item.description || item.description.trim() === "") {
    return res.status(400).json({ message: `Beschreibung fehlt in Position ${i + 1}.` });
  }

  if (item.quantity == null || item.quantity === "" || Number(item.quantity) <= 0) {
    return res.status(400).json({ message: `Menge fehlt oder ist ungültig in Position ${i + 1}.` });
  }

  if (item.unit_price_gross == null || item.unit_price_gross === "" || Number(item.unit_price_gross) <= 0) {
    return res.status(400).json({ message: `Einzelpreis fehlt oder ist ungültig in Position ${i + 1}.` });
  }

  if (item.vat_key == null || !(item.vat_key === 1 || item.vat_key === 2)) {
    return res.status(400).json({ message: `MwSt-Schlüssel fehlt oder ist ungültig in Position ${i + 1}.` });
  }
}

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    if (!invoice.date) {
    return res.status(400).json({ message: "Rechnungsdatum ist erforderlich." });
    }

    // --- EMPFÄNGER ERMITTELN ODER ANLEGEN -----------------------------

    // Whitespace etwas bereinigen, um doppelte Treffer zu vermeiden
    const rName   = (recipient.name   || "").trim();
    const rStreet = (recipient.street || "").trim();
    const rZip    = (recipient.zip    || "").trim();
    const rCity   = (recipient.city   || "").trim();

    let recipientId;

    // 1. Prüfen, ob ein Empfänger mit denselben Stammdaten schon existiert
    const existingRecipient = await client.query(
      `
      SELECT id 
      FROM recipients
      WHERE 
        LOWER(name)   = LOWER($1)
        AND LOWER(street) = LOWER($2)
        AND zip       = $3
        AND LOWER(city)   = LOWER($4)
      LIMIT 1
      `,
      [rName, rStreet, rZip, rCity]
    );

    if (existingRecipient.rowCount > 0) {
      // ✅ Kunde existiert bereits → vorhandene ID verwenden
      recipientId = existingRecipient.rows[0].id;
    } else {
      // ❌ Kunde existiert noch nicht → neu anlegen
      const recipientResult = await client.query(
        `
        INSERT INTO recipients (name, street, zip, city, email, phone)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
        `,
        [
          rName,
          rStreet,
          rZip,
          rCity,
          recipient.email || null,
          recipient.phone || null
        ]
      );

      recipientId = recipientResult.rows[0].id;
    }

    // 2. Gesamtsummen berechnen
    const totals = calculateTotals(items);

    // Leere Strings auf null mappen, damit Postgres nicht meckert
    const invoiceDate = invoice.date && invoice.date.trim() !== "" ? invoice.date : null;
    const receiptDate = invoice.receipt_date && invoice.receipt_date.trim() !== "" ? invoice.receipt_date : null;
    const category    = invoice.category && invoice.category.trim() !== "" ? invoice.category : null;

    // B2B + USt-ID aus dem Payload
    const isB2B  = invoice.b2b === true;              // kommt als boolean aus dem Frontend
    const ustId  = invoice.ust_id && invoice.ust_id.trim() !== "" ? invoice.ust_id.trim() : null;

    // 3. Rechnung anlegen
  const invoiceResult = await client.query(
    `
    INSERT INTO invoices (
      invoice_number,
      date,
      recipient_id,
      category,
      receipt_date,
      b2b,
      ust_id,
      net_19, vat_19, gross_19,
      net_7, vat_7, gross_7,
      gross_total
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7,
      $8, $9, $10,
      $11, $12, $13,
      $14
    )
    RETURNING id
    `,
    [
      invoice.invoice_number,
      invoiceDate,
      recipientId,
      category,
      receiptDate,
      isB2B,
      ustId,

      totals.net_19,
      totals.vat_19,
      totals.gross_19,

      totals.net_7,
      totals.vat_7,
      totals.gross_7,

      totals.gross_total
    ]
  );

    const invoiceId = invoiceResult.rows[0].id;

    // 4. Positionen speichern
    for (const item of items) {
      const gross = n(item.quantity) * n(item.unit_price_gross);

      await client.query(
        `
        INSERT INTO invoice_items (
          invoice_id, description, quantity, unit_price_gross, vat_key, line_total_gross
        ) VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          invoiceId,
          item.description,
          item.quantity,
          item.unit_price_gross,
          item.vat_key,
          gross
        ]
      );
    }

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Rechnung erfolgreich erstellt",
      invoice_id: invoiceId
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Fehler bei der Rechnungserstellung:", err);

    return res.status(500).json({
      error: "Es ist ein Fehler beim Erstellen der Rechnung aufgetreten."
    });
  } finally {
    client.release();
  }
};

/**
 * GET /api/invoices
 * Liste aller Rechnungen
 */
export const getAllInvoices = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT invoices.*, recipients.name AS recipient_name
      FROM invoices
      LEFT JOIN recipients ON invoices.recipient_id = recipients.id
      ORDER BY invoices.id DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("Fehler beim Laden der Rechnungen:", err);
    res.status(500).json({ error: "Fehler beim Abrufen der Rechnungen" });
  }
};

/**
 * GET /api/invoices/:id
 * Einzelne Rechnung laden
 */
export const getInvoiceById = async (req, res) => {
  const id = Number(req.params.id);

  if (!id) return res.status(400).json({ message: "Ungültige Rechnungs-ID" });

  const client = await db.connect();

  try {
    const invoiceResult = await client.query(`
      SELECT 
        i.*,
        r.name  AS recipient_name,
        r.street AS recipient_street,
        r.zip   AS recipient_zip,
        r.city  AS recipient_city,
        c.logo_file AS category_logo_file
      FROM invoices i
      LEFT JOIN recipients r ON i.recipient_id = r.id
      LEFT JOIN invoice_categories c ON c.key = i.category
      WHERE i.id = $1
    `, [id]);

    if (invoiceResult.rowCount === 0)
      return res.status(404).json({ message: "Rechnung nicht gefunden" });

    const row = invoiceResult.rows[0];

    const invoice = {
      id: row.id,
      invoice_number: row.invoice_number,
      date: row.date,
      category: row.category,
      receipt_date: row.receipt_date,
      status_sent: row.status_sent,
      status_sent_at: row.status_sent_at,
      status_paid_at: row.status_paid_at,
      net_19: row.net_19,
      vat_19: row.vat_19,
      gross_19: row.gross_19,
      net_7: row.net_7,
      vat_7: row.vat_7,
      gross_7: row.gross_7,
      gross_total: row.gross_total,
      recipient: {
        id: row.recipient_id,
        name: row.recipient_name,
        street: row.recipient_street,
        zip: row.recipient_zip,
        city: row.recipient_city,
        email: row.recipient_email,
        phone: row.recipient_phone
      }
    };

    const itemsResult = await client.query(
      `
      SELECT id, description, quantity, unit_price_gross, vat_key, line_total_gross
      FROM invoice_items
      WHERE invoice_id = $1
      ORDER BY id ASC
      `,
      [id]
    );

    return res.json({ invoice, items: itemsResult.rows });

  } catch (err) {
    console.error("Fehler beim Laden der Rechnung:", err);
    res.status(500).json({ error: "Fehler beim Abrufen der Rechnung" });
  } finally {
    client.release();
  }

  // Kategorie-Logo bestimmen
  let logoBase64ForInvoice = defaultLogoBase64;

  if (row.category_logo_file) {
    try {
      const catLogoPath = path.join(__dirname, "../../public/logos", row.category_logo_file);
      if (fs.existsSync(catLogoPath)) {
        logoBase64ForInvoice = fs.readFileSync(catLogoPath, "base64");
      } else {
        console.warn("Kategorie-Logo nicht gefunden, verwende Default:", catLogoPath);
      }
    } catch (e) {
      console.warn("Fehler beim Laden des Kategorie-Logos, verwende Default:", e.message);
    }
  }

};

/**
 * GET /api/invoices/:id/pdf
 * Apple-like PDF generieren + speichern in /pdfs
 */
export const getInvoicePdf = async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: "Ungültige Rechnungs-ID" });

  const client = await db.connect();

  try {
    const invoiceResult = await client.query(`
      SELECT 
        i.*,
        r.name   AS recipient_name,
        r.street AS recipient_street,
        r.zip    AS recipient_zip,
        r.city   AS recipient_city,
        c.logo_file AS category_logo_file
      FROM invoices i
      LEFT JOIN recipients r ON i.recipient_id = r.id
      LEFT JOIN invoice_categories c ON c.key = i.category
      WHERE i.id = $1
    `, [id]);

    if (invoiceResult.rowCount === 0)
      return res.status(404).json({ message: "Rechnung nicht gefunden" });

    const row = invoiceResult.rows[0];

    const invoice = {
      invoice_number: row.invoice_number,
      date: row.date,
      receipt_date: row.receipt_date,
      b2b: row.b2b === true,
      ust_id: row.ust_id || null,
      net_19: n(row.net_19),
      net_7: n(row.net_7),
      vat_19: n(row.vat_19),
      vat_7: n(row.vat_7),
      gross_total: n(row.gross_total),
      recipient: {
        name: row.recipient_name,
        street: row.recipient_street,
        zip: row.recipient_zip,
        city: row.recipient_city
      }
    };

    // 🔹 Logo für diese konkrete Rechnung bestimmen
// Standard: Default-Logo
let logoBase64ForInvoice = defaultLogoBase64;

// Wenn in der Kategorie ein eigenes Logo hinterlegt ist → versuchen zu laden
if (row.category_logo_file) {
  try {
    const categoryLogoPath = path.join(
      __dirname,
      "../../public/logos",
      row.category_logo_file
    );

    if (fs.existsSync(categoryLogoPath)) {
      logoBase64ForInvoice = fs.readFileSync(categoryLogoPath, "base64");
      console.log("Kategorie-Logo geladen:", categoryLogoPath);
    } else {
      console.warn("Kategorie-Logo nicht gefunden, nutze Default-Logo:", categoryLogoPath);
    }
  } catch (err) {
    console.warn("Fehler beim Laden des Kategorie-Logos, nutze Default-Logo:", err);
  }
}

    // Hilfswerte für die Anzeige im PDF
    const totalNet = invoice.net_19 + invoice.net_7;
    const totalVat = invoice.vat_19 + invoice.vat_7;

    const itemsResult = await client.query(
      "SELECT description, quantity, unit_price_gross, line_total_gross FROM invoice_items WHERE invoice_id = $1 ORDER BY id ASC",
      [id]
    );

    const items = itemsResult.rows;

    const formattedDate =
      invoice.date ? new Date(invoice.date).toLocaleDateString("de-DE") : "";
    const formattedReceiptDate =
      invoice.receipt_date ? new Date(invoice.receipt_date).toLocaleDateString("de-DE") : "";

    const itemsRowsHtml = items
      .map((item) => {
        const q = n(item.quantity);
        const up = n(item.unit_price_gross).toFixed(2);
        const total = n(item.line_total_gross).toFixed(2);

        return `
          <tr>
            <td>${item.description}</td>
            <td style="text-align:right;"><span class="amount">${q}</span></td>
            <td style="text-align:right;"><span class="amount">${up} €</span></td>
            <td style="text-align:right;"><span class="amount">${total} €</span></td>
          </tr>
        `;
      })
      .join("");

        // 🔹 SEPA QR-Daten im EPC-Format
    // Werte aus .env laden – mit Fallback, falls etwas fehlt
    const creditorName = SEPA_CREDITOR_NAME || "UNBEKANNT";
    const creditorIban = SEPA_CREDITOR_IBAN || "DE00000000000000000000";
    const creditorBic = SEPA_CREDITOR_BIC || "UNKNOWNBIC";

    const amount = invoice.gross_total || 0; // Number
    const sepaAmount = `EUR${amount.toFixed(2)}`; // z.B. "EUR123.45"

    // 🔹 Dynamischer Verwendungszweck: Rechnung + Name des Kunden
    let sepaPurpose = `Rechnung ${invoice.invoice_number} / ${invoice.recipient.name}`;
    sepaPurpose = normalizeEpcText(sepaPurpose);

    const sepaPayload = [
      "BCD",
      "002",
      "1",
      "SCT",
      creditorBic,
      creditorName,
      creditorIban,
      sepaAmount,
      "",
      sepaPurpose
    ].join("\n");

    // 🔹 SEPA QR als Base64 PNG erzeugen
    const sepaQrBase64 = await QRCode.toDataURL(sepaPayload, {
      errorCorrectionLevel: "M",
      margin: 1,
      scale: 5
    });

    // ❤️ FERTIGES HTML-TEMPLATE KOMMT IN EXTRA BLOCK
    const html = generateInvoiceHtml(invoice, formattedDate, formattedReceiptDate, itemsRowsHtml, sepaQrBase64, logoBase64ForInvoice);

    //
    // ⭐ PUPPETEER FIX – DAMIT LOGO & ASSETS LADEN ⭐
    //
    const browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--allow-file-access-from-files",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process"
      ]
    });

    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(0);

    // HTML in Datei schreiben
    const tempPath = path.join(__dirname, "invoice_temp.html");
    fs.writeFileSync(tempPath, html, "utf-8");

    // Datei statt Data-URL öffnen
    await page.goto("file://" + tempPath, {
      waitUntil: "networkidle0"
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true
    });

    await browser.close();

    const pdfDir = path.join(__dirname, "../../pdfs");
    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });

    const filename = `RE-${invoice.invoice_number}.pdf`;
    const filepath = path.join(pdfDir, filename);

    fs.writeFileSync(filepath, pdfBuffer);

        const mode = req.query.mode;

    res.setHeader("Content-Type", "application/pdf");

    if (mode === "inline") {
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    } else if (mode === "download") {
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    } else {
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    }

    return res.send(pdfBuffer);

  } catch (err) {
    console.error("Fehler bei der PDF-Erstellung:", err);
    return res.status(500).json({ error: "Fehler bei der PDF-Erstellung" });
  } finally {
    client.release();
  }
};

function generateInvoiceHtml(invoice, formattedDate, formattedReceiptDate, itemsRowsHtml, sepaQrBase64, logoBase64ForInvoice) {
  return `
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8" />

<style>
  @page { size: A4; margin: 0; }

  body {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", Arial, sans-serif;
    font-size: 12px;
    background: #fff;
  }

  .page {
    position: relative;
    width: 210mm;
    height: 297mm;
    padding: 7mm 10mm 10mm 10mm;
    box-sizing: border-box;
  }

  /* Firmenblock rechts */
  .brand-box {
    position: absolute;
    top: 7mm;
    right: 10mm;
    width: 65mm;
    text-align: right;
  }

  .brand-box img {
    width: 48mm;
    margin-bottom: 2mm;
  }

  .brand-sub {
    font-size: 10.5px;
    color: #6e6e73;
    line-height: 1.35;
  }

  /* Absender DIN */
  .sender-line {
    position: absolute;
    top: 40mm;
    left: 20mm;
    font-size: 10px;
    color: #6e6e73;
  }

  /* Empfänger DIN */
  .recipient {
    position: absolute;
    top: 50mm;
    left: 20mm;
    width: 85mm;
    font-size: 13px;
    line-height: 1.4;
  }

  .content {
    position: absolute;
    top: 90mm;
    left: 10mm;
    right: 10mm;
  }

  .meta {
    text-align: right;
    margin-bottom: 8mm;
  }

  .invoice-title {
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 5mm;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  th, td {
    font-family: Arial, Helvetica, sans-serif !important;
    padding: 5px 2px;
    border-bottom: 1px solid #eee;
    white-space: nowrap;
  }

  td .amount {
    display: inline-block;
  }

  th:nth-child(1), td:nth-child(1) { width: 50%; text-align: left; }
  th:nth-child(2), td:nth-child(2) { width: 10%; text-align: right; }
  th:nth-child(3), td:nth-child(3) { width: 20%; text-align: right; }
  th:nth-child(4), td:nth-child(4) { width: 20%; text-align: right; }

  .totals-wrapper {
    width: 55mm;
    margin-left: auto;
    margin-top: 8mm;
  }

  .final-total-box {
    margin-top: 6mm;
    background: #f5f7ff;
    border: 1px solid #d9dfff;
    padding: 8px;
    border-radius: 10px;
    text-align: right;
  }

  .final-box-label {
    margin-top: 6mm;
    background: #fff5f5ff;
    border: 1px solid #ffd9d9ff;
    padding: 8px;
    border-radius: 10px;
    text-align: right;
  }

  .final-total-value {
    font-size: 18px;
    font-weight: 700;
  }

  .footer {
    position: absolute;
    bottom: 10mm;
    left: 10mm;
    right: 10mm;
    font-size: 10.5px;
    color: #6e6e73;
    border-top: 1px solid #dcdcdc;
    padding-top: 3mm;
  }
</style>
</head>

<body>

<div class="page">

  <!-- DIN 5008 Knickmarken -->
  <div style="
    position:absolute;
    left:5mm;
    top:87mm;
    width:4mm;
    height:0;
    border-top:0.3mm solid #999;
  "></div>

  <div style="
    position:absolute;
    left:5mm;
    top:192mm;
    width:4mm;
    height:0;
    border-top:0.3mm solid #999;
  "></div>

  <div style="
    position:absolute;
    right:5mm;
    top:87mm;
    width:4mm;
    height:0;
    border-top:0.3mm solid #999;
  "></div>

  <div style="
    position:absolute;
    right:5mm;
    top:192mm;
    width:4mm;
    height:0;
    border-top:0.3mm solid #999;
  "></div>

  <div class="brand-box">
  <img src="data:image/png;base64,${logoBase64ForInvoice}" />
  <div class="brand-sub">
      Thomas Pilger<br>
      Mauspfad 3 · 53842 Troisdorf<br>
      Tel: 02241 76649<br>
      E-Mail: welcome@forsthaus-telegraph.de<br>
      www.der-heidekoenig.de
  </div>
</div>

  <div class="sender-line">
    Waldwirtschaft Heidekönig · Mauspfad 3 · 53842 Troisdorf
  </div>

  <div class="recipient">
    <strong>${invoice.recipient.name}</strong><br/>
    ${invoice.recipient.street}<br/>
    ${invoice.recipient.zip} ${invoice.recipient.city}
  </div>

  <div class="content">

    <div class="meta">
      <div><strong>Rechnungsnr:</strong> ${invoice.invoice_number}</div>
      <div><strong>Datum:</strong> ${formattedDate}</div>
      ${formattedReceiptDate ? `<div><strong>Belegdatum:</strong> ${formattedReceiptDate}</div>` : ""}
      ${invoice.b2b && invoice.ust_id ? `<div><strong>USt-ID Kunde:</strong> ${invoice.ust_id}</div>` : ""}
    </div>
    <div class="invoice-title">
      Rechnung${invoice.b2b ? " (B2B)" : ""}
    </div>

    <table>
      <thead>
        <tr>
          <th>Beschreibung</th>
          <th>Menge</th>
          <th>Einzelpreis</th>
          <th>Gesamt</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRowsHtml}
      </tbody>
    </table>

    <div class="totals-wrapper">
      <table>
        <tr><td>Zwischensumme</td><td><span class="amount">${(invoice.net_19 + invoice.net_7).toFixed(2)} €</span></td></tr>
        <tr><td>MwSt 19%</td><td><span class="amount">${invoice.vat_19.toFixed(2)} €</span></td></tr>
        <tr><td>MwSt 7%</td><td><span class="amount">${invoice.vat_7.toFixed(2)} €</span></td></tr>
      </table>

      <div class="final-total-box">
      <div class="final-total-value">
        <span class="amount">
          ${
            invoice.b2b
              ? (invoice.net_19 + invoice.net_7).toFixed(2) + " € (Netto-Endbetrag)"
              : invoice.gross_total.toFixed(2) + " €"
          }
        </span>
      </div>
      </div>
    </div>
        
  </div>

  <!-- SEPA QR-Code rechts unten -->
    <div class="final-total-box" style="position:absolute; bottom:30mm; right:15mm; text-align:center;">
      <img src="${sepaQrBase64}" style="width:25mm; height:25mm; margin-bottom:4px;" />
      <div style="font-size:11px; color:#333;">Bequem per SEPA-QR bezahlen</div>
    </div>

    <!-- Reverse-Charge Hinweis links unten (nur B2B) -->
    ${
      invoice.b2b
        ? `
    <div class="final-box-label" style="position:absolute; bottom:30mm; left:15mm; text-align:left;">
      <p style="margin-top:10px; font-size:12px; color:#444;">
        Innergemeinschaftliche Leistung / Reverse-Charge.<br>
        MwSt wird ausgewiesen, der Rechnungsendbetrag ist jedoch ein Netto-Endbetrag gemäß <br>
        Steuerschuldnerschaft des Leistungsempfängers (§ 13b UStG).
      </p>
    </div>
    `
        : ""
    }

    <div class="footer">
      Steuernummer: 220/5060/2434 · USt-IdNr.: DE123224453<br>
      Bankverbindung: VR-Bank Bonn Rhein-Sieg eG · 
      IBAN: DE48 3706 9520 1104 1850 25 · 
      BIC: GENODED1RST
    </div>

</div>

</body>
</html>
  `;
}

/**
 * POST /api/invoices/:id/status/sent
 * Rechnung als versendet markieren
 */
export const markSent = async (req, res) => {
  const id = Number(req.params.id);

  if (!id) return res.status(400).json({ error: "Ungültige Rechnungs-ID" });

  try {
    await db.query(
      "UPDATE invoices SET status_sent = true, status_sent_at = NOW() WHERE id = $1",
      [id]
    );

    return res.json({ message: "Rechnung als versendet markiert" });
  } catch (err) {
    console.error("Fehler beim Markieren als versendet:", err);
    return res.status(500).json({ error: "Fehler beim Aktualisieren des Status" });
  }
};

/**
 * POST /api/invoices/:id/status/paid
 * Rechnung als bezahlt markieren
 */
export const markPaid = async (req, res) => {
  const id = Number(req.params.id);

  if (!id) return res.status(400).json({ error: "Ungültige Rechnungs-ID" });

  try {
    await db.query(
      "UPDATE invoices SET status_paid_at = NOW() WHERE id = $1",
      [id]
    );

    return res.json({ message: "Rechnung als bezahlt markiert" });
  } catch (err) {
    console.error("Fehler beim Markieren als bezahlt:", err);
    return res.status(500).json({ error: "Fehler beim Aktualisieren des Status" });
  }
};

// ...
/**
 * DELETE /api/invoices/:id
 * Rechnung (und Positionen) löschen
 */
export const deleteInvoice = async (req, res) => {
  const id = Number(req.params.id);

  if (!id) return res.status(400).json({ error: "Ungültige Rechnungs-ID" });

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // Positionen löschen (falls kein ON DELETE CASCADE gesetzt ist)
    await client.query(
      "DELETE FROM invoice_items WHERE invoice_id = $1",
      [id]
    );

    // Rechnung holen (für evtl. PDF-Datei)
    const invoiceResult = await client.query(
      "SELECT invoice_number FROM invoices WHERE id = $1",
      [id]
    );

    if (invoiceResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Rechnung nicht gefunden" });
    }

    const invoiceNumber = invoiceResult.rows[0].invoice_number;

    // Rechnung löschen
    await client.query("DELETE FROM invoices WHERE id = $1", [id]);

    await client.query("COMMIT");

    // PDF-Datei (falls vorhanden) löschen
    try {
      const pdfDir = path.join(__dirname, "../../pdfs");
      const filename = `Rechnung-${invoiceNumber}.pdf`;
      const filepath = path.join(pdfDir, filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    } catch (err) {
      console.warn("Konnte PDF-Datei nicht löschen:", err.message);
    }

    return res.json({ message: "Rechnung gelöscht" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Fehler beim Löschen der Rechnung:", err);
    return res.status(500).json({ error: "Fehler beim Löschen der Rechnung" });
  } finally {
    client.release();
  }
};

// -------------------------------------------------------------
// 🔢 Automatische Rechnungsnummer im Format YYYYMM001
//    – pro Monat neu beginnend
// -------------------------------------------------------------
export const getNextInvoiceNumber = async (req, res) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const prefix = `${year}${month}`; // z.B. "202502"

    const result = await db.query(
      `
      SELECT invoice_number
      FROM invoices
      WHERE invoice_number LIKE $1
      ORDER BY invoice_number DESC
      LIMIT 1
      `,
      [prefix + "%"]
    );

    let nextRunningNumber = 1;

    if (result.rowCount > 0) {
      const lastNumber = result.rows[0].invoice_number;
      const lastSuffix = lastNumber.substring(6); // alles nach YYYYMM
      const lastInt = parseInt(lastSuffix, 10) || 0;
      nextRunningNumber = lastInt + 1;
    }

    const suffix = String(nextRunningNumber).padStart(3, "0");
    const next = `${prefix}${suffix}`;

    return res.json({ next });
  } catch (err) {
    console.error("Fehler bei next-number:", err);
    return res
      .status(500)
      .json({ message: "Fehler beim Ermitteln der Rechnungsnummer" });
  }
};