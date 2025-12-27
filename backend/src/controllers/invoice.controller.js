import { prisma } from "../utils/prisma.js";
import { getResolvedPdfPath } from "../utils/pdfSettings.js";
import puppeteer from "puppeteer";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { getBankSettings } from "../utils/bankSettings.js";
import { getDatevSettings } from "../utils/datevSettings.js";
import nodemailer from "nodemailer";
import { ensureInvoiceCategoriesTable } from "../utils/categoryTable.js";
import { getInvoiceHeaderSettings } from "../utils/invoiceHeaderSettings.js";
import {
  buildDatevMailBody,
  buildDatevMailSubject,
  buildDatevRecipients,
  ensureDatevExportColumns,
  updateDatevExportStatus,
  DATEV_STATUS,
} from "../utils/datevExport.js";
import { sendHkformsStatus } from "../utils/hkformsSync.js";
import {
  resolveGlobalSmtpFromDb,
  resolveGlobalSmtpFromEnv,
} from "../utils/smtpSettings.js";
import { getGlobalEmailTemplate } from "../utils/emailTemplates.js";

const fetchFirstItemDescription = async (invoiceId) => {
  if (!invoiceId) return null;
  const item = await prisma.invoice_items.findFirst({
    where: { invoice_id: invoiceId },
    orderBy: { id: "asc" },
    select: { description: true },
  });
  return item?.description || null;
};

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

// 🔹 Standard-Logo (Fallback, wenn Kategorie kein eigenes Logo hat)
const defaultLogoPath = path.join(__dirname, "../../public/logos/HK_LOGO.png");

const getPdfDir = async () => {
  const dir = await getResolvedPdfPath();
  await fs.promises.mkdir(dir, { recursive: true }).catch(() => {});
  return dir;
};

const moveInvoicePdfToArchive = async (invoiceNumber) => {
  try {
    const pdfDir = await getPdfDir();
    const archiveDir = path.join(pdfDir, "archive");
    await fs.promises.mkdir(archiveDir, { recursive: true });
    const candidates = [`RE-${invoiceNumber}.pdf`, `Rechnung-${invoiceNumber}.pdf`];
    for (const name of candidates) {
      const source = path.join(pdfDir, name);
      if (fs.existsSync(source)) {
        const parsed = path.parse(name);
        let target = path.join(archiveDir, name);
        if (fs.existsSync(target)) {
          target = path.join(archiveDir, `${parsed.name}-${Date.now()}${parsed.ext}`);
        }
        await fs.promises.rename(source, target);
        console.log(`[Cancel] PDF archiviert: ${name}`);
      }
    }
  } catch (err) {
    console.warn(`[Cancel] PDF-Archivierung fehlgeschlagen (${invoiceNumber}):`, err.message);
  }
};

let defaultLogoBase64 = "";
try {
  defaultLogoBase64 = fs.readFileSync(defaultLogoPath, "base64");
  console.log("Standard-Logo erfolgreich geladen:", defaultLogoPath);
} catch (err) {
  console.error("Standard-Logo konnte NICHT geladen werden:", defaultLogoPath, err);
}

const n = (value) => Number(value) || 0;
const toNumber = (value) =>
  value === null || value === undefined
    ? value
    : typeof value === "number"
    ? value
    : Number(value);
const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const stripHtmlToText = (html) => {
  if (!html) return "";
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "</p>\n")
    .replace(/<\/div>/gi, "</div>\n")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/\s{2,}/g, " ")
    .trim();
};

const addDaysSafe = (value, days) => {
  const date = new Date(value);
  if (isNaN(date)) return null;
  date.setDate(date.getDate() + days);
  return date;
};

const formatDateDe = (value) => {
  if (!value) return "–";
  const d = new Date(value);
  return isNaN(d) ? "–" : d.toLocaleDateString("de-DE");
};

const formatIban = (iban) => {
  if (!iban) return "-";
  return iban.replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim();
};

const formatCurrencyDe = (val) =>
  n(val).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatNumberDe = (val) =>
  n(val).toLocaleString("de-DE", {
    maximumFractionDigits: 2,
  });

const placeholderRegex = (ph) => new RegExp(ph.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");

const buildPlaceholderMap = (row = {}, bankSettings = {}, headerSettings = {}) => {
  const amountValue = row.b2b ? n(row.net_19) + n(row.net_7) : n(row.gross_total);
  const amountDisplay = amountValue.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return {
    "{{recipient_name}}": row.recipient_name || "",
    "{{recipient_street}}": row.recipient_street || "",
    "{{recipient_zip}}": row.recipient_zip || "",
    "{{recipient_city}}": row.recipient_city || "",
    "{{invoice_number}}": row.invoice_number || "",
    "{{invoice_date}}": formatDateDe(row.date),
    "{{due_date}}": formatDateDe(addDaysSafe(row.date, 14)),
    "{{amount}}": amountDisplay ? `${amountDisplay} €` : "",
    "{{bank_name}}": bankSettings.bank_name || "",
    "{{iban}}": formatIban(bankSettings.iban),
    "{{bic}}": (bankSettings.bic || "").toUpperCase(),
    "{{company_name}}": headerSettings.company_name || "",
    "{{category_name}}": row.category_label || row.category || "",
  };
};

const replacePlaceholders = (template = "", replacements = {}, escapeValues = true) => {
  let result = String(template ?? "");
  Object.entries(replacements).forEach(([ph, val]) => {
    const safeValue = escapeValues ? escapeHtml(val) : val;
    result = result.replace(placeholderRegex(ph), safeValue);
  });
  return result;
};

const ensureHtmlBody = (rawBody = "", fallbackText = "") => {
  const body = String(rawBody || "").trim();
  if (!body) {
    return fallbackText
      ? escapeHtml(fallbackText).replace(/\r?\n/g, "<br>")
      : "";
  }
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(body);
  return looksLikeHtml
    ? body
    : escapeHtml(body).replace(/\r?\n/g, "<br>");
};

const normalizeInvoiceDecimals = (row) => {
  const decimalFields = [
    "net_19",
    "vat_19",
    "gross_19",
    "net_7",
    "vat_7",
    "gross_7",
    "gross_total",
  ];
  for (const field of decimalFields) {
    if (field in row) {
      row[field] = toNumber(row[field]);
    }
  }
  return row;
};

const shapeInvoiceListRow = (invoice, recipient, category) => {
  const base = normalizeInvoiceDecimals({ ...invoice });
  return {
    ...base,
    recipient_name: recipient?.name || null,
    recipient_email: recipient?.email || null,
    category_id: category?.id || null,
    category_label: category?.label || null,
    datev_export_status: invoice.datev_export_status || null,
    datev_exported_at: invoice.datev_exported_at || null,
    datev_export_error: invoice.datev_export_error || null,
  };
};

const loadInvoiceWithCategory = async (id) => {
  await ensureInvoiceCategoriesTable();
  await ensureDatevExportColumns();
  const invoice = await prisma.invoices.findUnique({
    where: { id },
    include: { recipients: true },
  });

  if (!invoice) {
    const err = new Error("Rechnung nicht gefunden");
    err.code = "NOT_FOUND";
    throw err;
  }

  let category = null;
  let emailAccount = null;
  let template = null;

  if (invoice.category) {
    category = await prisma.invoice_categories.findUnique({
      where: { key: invoice.category },
      include: {
        category_email_accounts: true,
        category_templates: true,
      },
    });
    emailAccount = category?.category_email_accounts || null;
    template = category?.category_templates || null;
  }

  const row = normalizeInvoiceDecimals({
    ...invoice,
    recipient_name: invoice.recipients?.name || null,
    recipient_street: invoice.recipients?.street || null,
    recipient_zip: invoice.recipients?.zip || null,
    recipient_city: invoice.recipients?.city || null,
    recipient_email: invoice.recipients?.email || null,
    recipient_phone: invoice.recipients?.phone || null,
    category_id: category?.id || null,
    category_key: category?.key || null,
    category_label: category?.label || null,
    email_display_name: emailAccount?.display_name || null,
    email_address: emailAccount?.email_address || null,
    email_smtp_host: emailAccount?.smtp_host || null,
    email_smtp_port: emailAccount?.smtp_port || null,
    email_smtp_secure:
      emailAccount?.smtp_secure === false ? false : emailAccount?.smtp_secure ?? null,
    email_smtp_user: emailAccount?.smtp_user || null,
    email_smtp_pass: emailAccount?.smtp_pass || null,
    tpl_subject: template?.subject || null,
    tpl_body_html: template?.body_html || null,
  });

  return row;
};

const resolveSmtpConfig = async (row = {}) => {
  if (
    row.email_address &&
    row.email_smtp_host &&
    row.email_smtp_port &&
    row.email_smtp_user &&
    row.email_smtp_pass
  ) {
    const from = row.email_display_name
      ? `${row.email_display_name} <${row.email_address}>`
      : row.email_address;
    return {
      host: row.email_smtp_host,
      port: Number(row.email_smtp_port),
      secure: row.email_smtp_secure === false ? false : true,
      authUser: row.email_smtp_user,
      authPass: row.email_smtp_pass,
      from,
      usingCategoryAccount: true,
    };
  }

  const dbConfig = await resolveGlobalSmtpFromDb();
  if (dbConfig) {
    return { ...dbConfig, usingCategoryAccount: false };
  }

  const envConfig = resolveGlobalSmtpFromEnv();
  if (envConfig) {
    return { ...envConfig, usingCategoryAccount: false };
  }

  return null;
};

const buildEmailContent = (row, bankSettings = {}, headerSettings = {}, globalTemplate = null) => {
  const placeholders = buildPlaceholderMap(row, bankSettings, headerSettings);
  const fallbackSubject = `Rechnung Nr. ${row.invoice_number}`;

  const defaultBody = `Hallo ${row.recipient_name || "Kunde"},

anbei erhältst du deine Rechnung Nr. ${row.invoice_number} vom ${formatDateDe(row.date)}.
Der Betrag von ${placeholders["{{amount}}"] || ""} ist fällig bis ${placeholders["{{due_date}}"]}.

Bankverbindung:
${placeholders["{{bank_name}}"] || "-"}
IBAN: ${placeholders["{{iban}}"] || "-"}
BIC: ${placeholders["{{bic}}"] || "-"}

Bei Fragen melde dich gerne jederzeit.

Vielen Dank für deinen Auftrag!

Beste Grüße
${placeholders["{{company_name}}"] || "Ihr Team"}`;

  const useSubjectTpl = row.tpl_subject || globalTemplate?.subject_template || null;
  const useHtmlTpl = row.tpl_body_html || globalTemplate?.body_html_template || null;
  const useTextTpl = globalTemplate?.body_text_template || null;

  const subject = useSubjectTpl
    ? replacePlaceholders(useSubjectTpl, placeholders, false) || fallbackSubject
    : fallbackSubject;

  let bodyHtml = useHtmlTpl
    ? replacePlaceholders(useHtmlTpl, placeholders, true)
    : null;

  let bodyText = bodyHtml ? stripHtmlToText(bodyHtml) : defaultBody;

  if (!bodyHtml && useTextTpl) {
    const renderedText = replacePlaceholders(useTextTpl, placeholders, false);
    bodyHtml = ensureHtmlBody(renderedText, renderedText);
    bodyText = renderedText;
  }

  return {
    subject,
    bodyHtml,
    bodyText,
    templateUsed: Boolean(row.tpl_subject || row.tpl_body_html || globalTemplate),
    category: {
      id: row.category_id,
      key: row.category_key,
      label: row.category_label,
    },
  };
};

// Setzt den PDF-Metadaten-Titel (Acrobat zeigt sonst file://invoice_temp.html)
function setPdfTitle(buffer, title) {
  try {
    const escapePdfString = (text) =>
      String(text || "")
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)");

    const pdfText = buffer.toString("latin1");
    const escapedTitle = escapePdfString(title);
    const titleRegex = /\/Title\s*\(([^)]*)\)/;

    if (titleRegex.test(pdfText)) {
      const updated = pdfText.replace(titleRegex, `/Title (${escapedTitle})`);
      return Buffer.from(updated, "latin1");
    }

    // Fallback: rohe Zeichenkette austauschen, falls Chromium "invoice_temp.html" reinschreibt
    const needle = "invoice_temp.html";
    const idx = pdfText.indexOf(needle);
    if (idx !== -1) {
      const target = escapedTitle;
      const maxLen = needle.length;
      let replacement = target.slice(0, maxLen);
      if (replacement.length < maxLen) {
        replacement = replacement.padEnd(maxLen, " ");
      }
      const updated = pdfText.slice(0, idx) + replacement + pdfText.slice(idx + maxLen);
      return Buffer.from(updated, "latin1");
    }

    return buffer;
  } catch (err) {
    console.warn("Konnte PDF-Titel nicht setzen, nutze Original-PDF.", err);
    return buffer;
  }
}

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

// -------------------------------------------------------------
// Hilfsfunktion für nächste Rechnungsnummer (YYYYMM + laufend)
// -------------------------------------------------------------
const computeNextInvoiceNumber = async () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `${year}${month}`;

  const last = await prisma.invoices.findFirst({
    where: { invoice_number: { startsWith: prefix } },
    orderBy: { invoice_number: "desc" },
    select: { invoice_number: true },
  });

  let nextRunningNumber = 1;
  if (last?.invoice_number) {
    const lastSuffix = last.invoice_number.substring(6);
    const lastInt = parseInt(lastSuffix, 10) || 0;
    nextRunningNumber = lastInt + 1;
  }

  const suffix = String(nextRunningNumber).padStart(3, "0");
  return `${prefix}${suffix}`;
};

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

  try {
    if (!invoice.date) {
      return res.status(400).json({ message: "Rechnungsdatum ist erforderlich." });
    }

    // Whitespace etwas bereinigen, um doppelte Treffer zu vermeiden
    const rName   = (recipient.name   || "").trim();
    const rStreet = (recipient.street || "").trim();
    const rZip    = (recipient.zip    || "").trim();
    const rCity   = (recipient.city   || "").trim();

    // Gesamtsummen berechnen
    const totals = calculateTotals(items);

    // Leere Strings auf null mappen
    const invoiceDate = invoice.date && invoice.date.trim() !== "" ? new Date(invoice.date) : null;
    const receiptDate = invoice.receipt_date && invoice.receipt_date.trim() !== "" ? new Date(invoice.receipt_date) : null;
    const category    = invoice.category && invoice.category.trim() !== "" ? invoice.category.trim() : null;
    const reservationRequestId = invoice.reservation_request_id && invoice.reservation_request_id.trim() !== "" ? invoice.reservation_request_id.trim() : null;
    const externalReference = invoice.external_reference && invoice.external_reference.trim() !== "" ? invoice.external_reference.trim() : null;

    const isB2B  = invoice.b2b === true;
    const ustId  = invoice.ust_id && invoice.ust_id.trim() !== "" ? invoice.ust_id.trim() : null;

    // Rechnungsnummer bestimmen/prüfen (außerhalb der Transaktion, um doppelte Antworten zu vermeiden)
    let invoiceNumber = (invoice.invoice_number || "").toString().trim();
    if (!invoiceNumber) {
      invoiceNumber = await computeNextInvoiceNumber();
    } else {
      const exists = await prisma.invoices.findFirst({
        where: { invoice_number: invoiceNumber },
        select: { id: true },
      });
      if (exists) {
        const suggested = await computeNextInvoiceNumber();
        return res.status(409).json({
          message: "Rechnungsnummer bereits vergeben. Vorschlag: " + suggested,
          suggested_next_number: suggested,
        });
      }
    }

    const txResult = await prisma.$transaction(async (tx) => {
      // Empfänger suchen/erstellen
      let recipientRow = await tx.recipients.findFirst({
        where: {
          name: rName,
          street: rStreet,
          zip: rZip,
          city: rCity,
        },
        select: { id: true },
      });

      if (!recipientRow) {
        recipientRow = await tx.recipients.create({
          data: {
            name: rName,
            street: rStreet || null,
            zip: rZip || null,
            city: rCity || null,
            email: recipient.email || null,
            phone: recipient.phone || null,
          },
          select: { id: true },
        });
      }

      const invoiceRow = await tx.invoices.create({
        data: {
          invoice_number: invoiceNumber,
          date: invoiceDate,
          recipient_id: recipientRow.id,
          category,
          reservation_request_id: reservationRequestId,
          external_reference: externalReference,
          receipt_date: receiptDate,
          b2b: isB2B,
          ust_id: ustId,
          net_19: totals.net_19,
          vat_19: totals.vat_19,
          gross_19: totals.gross_19,
          net_7: totals.net_7,
          vat_7: totals.vat_7,
          gross_7: totals.gross_7,
          gross_total: totals.gross_total,
        },
        select: { id: true },
      });

      const itemsData = items.map((item) => ({
        invoice_id: invoiceRow.id,
        description: item.description,
        quantity: item.quantity,
        unit_price_gross: item.unit_price_gross,
        vat_key: item.vat_key,
        line_total_gross: n(item.quantity) * n(item.unit_price_gross),
      }));

      if (itemsData.length) {
        await tx.invoice_items.createMany({
          data: itemsData,
        });
      }

      return invoiceRow.id;
    });

    return res.status(201).json({
      message: "Rechnung erfolgreich erstellt",
      invoice_id: txResult,
    });
  } catch (err) {
    console.error("Fehler bei der Rechnungserstellung:", err);

    if (err?.code === "P2002" && (err?.meta?.target || []).join(",").includes("reservation_request_id")) {
      return res.status(400).json({
        message: "Diese HKForms-Anfrage-ID ist bereits einer anderen Rechnung zugeordnet."
      });
    }
    if (err?.code === "P2002" && (err?.meta?.target || []).join(",").includes("invoice_number")) {
      const suggested = await computeNextInvoiceNumber().catch(() => null);
      return res.status(409).json({
        message: "Rechnungsnummer bereits vergeben." + (suggested ? " Vorschlag: " + suggested : ""),
        suggested_next_number: suggested || undefined,
      });
    }

    return res.status(500).json({
      error: "Es ist ein Fehler beim Erstellen der Rechnung aufgetreten."
    });
  }
};

/**
 * GET /api/invoices
 * Liste aller Rechnungen
 */
export const getAllInvoices = async (req, res) => {
  try {
    await ensureInvoiceCategoriesTable();
    await ensureDatevExportColumns();

    const { from, to, customer, status, category, category_id, limit } = req.query;

    let categoryKey = category || null;
    if (!categoryKey && category_id) {
      const cat = await prisma.invoice_categories.findUnique({
        where: { id: Number(category_id) || 0 },
        select: { key: true },
      });
      if (cat?.key) categoryKey = cat.key;
    }

    const where = {};

    // Zeitraum
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

    // Kategorie
    if (categoryKey) {
      where.category = categoryKey;
    }

    // Kunde/Empfänger (name search)
    if (customer && String(customer).trim() !== "") {
      where.recipients = {
        name: { contains: String(customer).trim(), mode: "insensitive" },
      };
    }

    // Status-Filter (Standard: stornierte ausblenden)
    const statusesRaw = status
      ? String(status)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const hasAll = statusesRaw.includes("all");
    const hasCanceled = statusesRaw.includes("canceled");
    const hasActive = statusesRaw.includes("active");
    const statuses = statusesRaw.filter((s) =>
      ["paid", "sent", "open", "canceled"].includes(s)
    );

    if (statuses.length && !hasAll && !hasActive) {
      const or = [];
      if (statuses.includes("paid")) {
        or.push({ status_paid_at: { not: null } });
      }
      if (statuses.includes("sent")) {
        or.push({ status_sent: true });
      }
      if (statuses.includes("open")) {
        or.push({ status_sent: { not: true }, status_paid_at: null });
      }
      if (statuses.includes("canceled")) {
        or.push({ canceled_at: { not: null } });
      }
      if (or.length) {
        where.AND = where.AND || [];
        where.AND.push({ OR: or });
      }
    }

    if (!hasAll && !hasCanceled) {
      where.canceled_at = null;
    }

    const take = limit ? Number(limit) : undefined;

    const invoices = await prisma.invoices.findMany({
      where,
      include: { recipients: true },
      orderBy: { invoice_number: "desc" },
      take,
    });

    const categoryKeys = Array.from(
      new Set(invoices.map((i) => i.category).filter(Boolean))
    );
    const categories = categoryKeys.length
      ? await prisma.invoice_categories.findMany({
          where: { key: { in: categoryKeys } },
          select: { id: true, key: true, label: true },
        })
      : [];
    const catByKey = new Map(categories.map((c) => [c.key, c]));

    const shaped = invoices.map((inv) =>
      shapeInvoiceListRow(inv, inv.recipients, catByKey.get(inv.category || ""))
    );

    res.json(shaped);
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

  try {
    await ensureInvoiceCategoriesTable();
    await ensureDatevExportColumns();

    const invoiceRow = await prisma.invoices.findUnique({
      where: { id },
      include: { recipients: true },
    });

    if (!invoiceRow) {
      return res.status(404).json({ message: "Rechnung nicht gefunden" });
    }

    const invoice = normalizeInvoiceDecimals({
      id: invoiceRow.id,
      invoice_number: invoiceRow.invoice_number,
      date: invoiceRow.date,
      category: invoiceRow.category,
      reservation_request_id: invoiceRow.reservation_request_id,
      external_reference: invoiceRow.external_reference,
      receipt_date: invoiceRow.receipt_date,
      status_sent: invoiceRow.status_sent,
      status_sent_at: invoiceRow.status_sent_at,
      status_paid_at: invoiceRow.status_paid_at,
      overdue_since: invoiceRow.overdue_since,
      datev_export_status: invoiceRow.datev_export_status,
      datev_exported_at: invoiceRow.datev_exported_at,
      datev_export_error: invoiceRow.datev_export_error,
      net_19: invoiceRow.net_19,
      vat_19: invoiceRow.vat_19,
      gross_19: invoiceRow.gross_19,
      net_7: invoiceRow.net_7,
      vat_7: invoiceRow.vat_7,
      gross_7: invoiceRow.gross_7,
      gross_total: invoiceRow.gross_total,
      canceled_at: invoiceRow.canceled_at,
      cancel_reason: invoiceRow.cancel_reason,
      recipient: {
        id: invoiceRow.recipient_id,
        name: invoiceRow.recipients?.name || null,
        street: invoiceRow.recipients?.street || null,
        zip: invoiceRow.recipients?.zip || null,
        city: invoiceRow.recipients?.city || null,
        email: invoiceRow.recipients?.email || null,
        phone: invoiceRow.recipients?.phone || null,
      },
    });

    const items = await prisma.invoice_items.findMany({
      where: { invoice_id: id },
      orderBy: { id: "asc" },
      select: {
        id: true,
        description: true,
        quantity: true,
        unit_price_gross: true,
        vat_key: true,
        line_total_gross: true,
      },
    });

    const shapedItems = items.map((item) => ({
      ...item,
      unit_price_gross: toNumber(item.unit_price_gross),
      line_total_gross: toNumber(item.line_total_gross),
    }));

    return res.json({ invoice, items: shapedItems });
  } catch (err) {
    console.error("Fehler beim Laden der Rechnung:", err);
    res.status(500).json({ error: "Fehler beim Abrufen der Rechnung" });
  }
};

/**
 * GET /api/invoices/:id/pdf
 * Apple-like PDF generieren + speichern in /pdfs
 */
export const getInvoicePdf = async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: "Ungültige Rechnungs-ID" });

  try {
    console.log(`[PDF] starte Generierung für Invoice ${id}`);
    const { buffer, filename } = await ensureInvoicePdf(id);
    console.log(`[PDF] fertig für Invoice ${id}: ${filename} (${buffer.length} bytes)`);
    const mode = req.query.mode;

    res.setHeader("Content-Type", "application/pdf");
    if (mode === "inline") {
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    } else {
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    }

    return res.send(buffer);
  } catch (err) {
    if (err?.code === "NOT_FOUND") {
      return res.status(404).json({ message: "Rechnung nicht gefunden" });
    }
    console.error("Fehler bei der PDF-Erstellung:", err);
    return res.status(500).json({ error: "Fehler bei der PDF-Erstellung" });
  }
};

/**
 * POST /api/invoices/:id/pdf/regenerate
 * Entfernt bestehendes PDF (falls vorhanden) und erzeugt ein neues
 */
export const regenerateInvoicePdf = async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: "Ungültige Rechnungs-ID" });

  try {
    const pdfDir = await getPdfDir();
    const invoiceRow = await prisma.invoices.findUnique({
      where: { id },
      select: { invoice_number: true },
    });
    if (!invoiceRow) {
      return res.status(404).json({ message: "Rechnung nicht gefunden" });
    }

    const filename = `RE-${invoiceRow.invoice_number}.pdf`;
    const filepath = path.join(pdfDir, filename);
    try {
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    } catch (err) {
      console.warn(`[PDF] Konnte bestehendes PDF nicht löschen (${filepath}):`, err.message);
    }

    const { filepath: finalPath, filename: finalName, buffer } = await ensureInvoicePdf(id);

    return res.json({
      message: "PDF neu erstellt.",
      filename: finalName,
      path: finalPath,
      size: buffer?.length || null,
    });
  } catch (err) {
    if (err?.code === "NOT_FOUND") {
      return res.status(404).json({ message: "Rechnung nicht gefunden" });
    }
    console.error("PDF Regenerate fehlgeschlagen:", err);
    return res.status(500).json({ message: "PDF konnte nicht neu erstellt werden." });
  }
};

/**
 * Erstellt bei Bedarf das PDF und liefert Buffer + Metadaten zurück
 */
async function ensureInvoicePdf(id) {
  await ensureInvoiceCategoriesTable();
  try {
    const invoiceRow = await prisma.invoices.findUnique({
      where: { id },
      include: { recipients: true },
    });

    if (!invoiceRow) {
      const error = new Error("Rechnung nicht gefunden");
      error.code = "NOT_FOUND";
      throw error;
    }
    console.log(`[PDF] Datenbank-Lookup ok für Invoice ${id}`);

    let categoryLogo = null;
    if (invoiceRow.category) {
      const category = await prisma.invoice_categories.findUnique({
        where: { key: invoiceRow.category },
        select: { logo_file: true },
      });
      categoryLogo = category?.logo_file || null;
    }

    const invoice = {
      invoice_number: invoiceRow.invoice_number,
      date: invoiceRow.date,
      receipt_date: invoiceRow.receipt_date,
      b2b: invoiceRow.b2b === true,
      ust_id: invoiceRow.ust_id || null,
      net_19: n(invoiceRow.net_19),
      net_7: n(invoiceRow.net_7),
      vat_19: n(invoiceRow.vat_19),
      vat_7: n(invoiceRow.vat_7),
      gross_total: n(invoiceRow.gross_total),
      recipient: {
        name: invoiceRow.recipients?.name || "",
        street: invoiceRow.recipients?.street || "",
        zip: invoiceRow.recipients?.zip || "",
        city: invoiceRow.recipients?.city || "",
      },
    };

    let logoBase64ForInvoice = defaultLogoBase64;
    if (categoryLogo) {
      try {
        const categoryLogoPath = path.join(
          __dirname,
          "../../public/logos",
          categoryLogo
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

    const itemsRows = await prisma.invoice_items.findMany({
      where: { invoice_id: id },
      orderBy: { id: "asc" },
      select: {
        description: true,
        quantity: true,
        unit_price_gross: true,
        line_total_gross: true,
      },
    });

    const items = itemsRows.map((item) => ({
      ...item,
      unit_price_gross: toNumber(item.unit_price_gross),
      line_total_gross: toNumber(item.line_total_gross),
    }));
    const bankSettings = await getBankSettings();
    const headerSettings = await getInvoiceHeaderSettings();
    console.log(`[PDF] ${items.length} Positionen + Bank-Settings geladen für Invoice ${id}`);

    const formattedDate =
      invoice.date ? new Date(invoice.date).toLocaleDateString("de-DE") : "";
    const formattedReceiptDate =
      invoice.receipt_date ? new Date(invoice.receipt_date).toLocaleDateString("de-DE") : "";

    const itemsRowsHtml = items
      .map((item) => {
        const q = formatNumberDe(item.quantity);
        const up = formatCurrencyDe(item.unit_price_gross);
        const total = formatCurrencyDe(item.line_total_gross);

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
    // Werte aus Settings (mit Fallback), Spaces entfernen
    const creditorName = normalizeEpcText(
      bankSettings.account_holder || bankSettings.bank_name || "UNBEKANNT"
    );
    const creditorIban = (bankSettings.iban || "DE00000000000000000000").replace(/\s+/g, "");
    const creditorBic = (bankSettings.bic || "UNKNOWNBIC").replace(/\s+/g, "");

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
    console.log(`[PDF] QR-Code erzeugt für Invoice ${id}`);

    // Briefkopf/Footersettings kombinieren (Header > Bank Fallback)
    const header = {
      company_name: headerSettings?.company_name || bankSettings.account_holder || "RechnungsAPP",
      address_line1: headerSettings?.address_line1 || "",
      address_line2: headerSettings?.address_line2 || "",
      zip: headerSettings?.zip || "",
      city: headerSettings?.city || "",
      country: headerSettings?.country || "",
      vat_id: headerSettings?.vat_id || "",
      footer_text: headerSettings?.footer_text || "",
      logo_url: headerSettings?.logo_url || null,
      bank_name: headerSettings?.bank_name || bankSettings.bank_name || "",
      iban: headerSettings?.iban || bankSettings.iban || "",
      bic: headerSettings?.bic || bankSettings.bic || "",
    };

    // Dateinamen/Pfade aus Settings ableiten
    const pdfDir = await getPdfDir();
    const filename = `RE-${invoiceRow.invoice_number}.pdf`;
    const filepath = path.join(pdfDir, filename);
    const filepathInline = path.join(pdfDir, `inline-${filename}`);

    // ❤️ FERTIGES HTML-TEMPLATE KOMMT IN EXTRA BLOCK
    const html = generateInvoiceHtml(
      invoice,
      formattedDate,
      formattedReceiptDate,
      itemsRowsHtml,
      sepaQrBase64,
      logoBase64ForInvoice,
      bankSettings,
      header
    );

    //
    // ⭐ PUPPETEER FIX – DAMIT LOGO & ASSETS LADEN ⭐
    //
    const chromiumPath =
      process.env.PUPPETEER_EXECUTABLE_PATH ||
      process.env.CHROMIUM_PATH ||
      ["/usr/bin/chromium-browser", "/usr/bin/chromium", "/usr/lib/chromium/chrome"].find(fs.existsSync);

    console.log(`[PDF] Starte Chromium (${chromiumPath}) für Invoice ${id}`);
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: chromiumPath,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote",
        "--allow-file-access-from-files",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process"
      ]
    });

    const page = await browser.newPage();
    console.log(`[PDF] Page erstellt für Invoice ${id}`);
    await page.setDefaultNavigationTimeout(30000);

    // HTML (debug optional auf Platte) – schreibe in ein beschreibbares temp-Verzeichnis
    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
    const tempPath = path.join(pdfDir, `invoice_${id}.tmp.html`);
    fs.writeFileSync(tempPath, html, "utf-8");
    await page.setContent(html, { waitUntil: "networkidle0" });
    console.log(`[PDF] HTML gesetzt für Invoice ${id}`);

    let pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true
    });
    console.log(`[PDF] PDF gerendert (${pdfBuffer.length} bytes) für Invoice ${id}`);

    // PDF-Metadaten-Titel auf Rechnungsdatei setzen
    pdfBuffer = setPdfTitle(pdfBuffer, filename);

    await browser.close();
    console.log(`[PDF] Browser geschlossen für Invoice ${id}`);

    // Temp-Datei aufräumen
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch (cleanupErr) {
      console.warn(`[PDF] Konnte temp HTML nicht löschen (${tempPath}):`, cleanupErr);
    }

    // Falls bereits final vorhanden und gültig: direkt zurückgeben (Concurrency-Fall)
    try {
      if (fs.existsSync(filepath)) {
        const stats = fs.statSync(filepath);
        if (stats.size > 0) {
          const existingBuffer = fs.readFileSync(filepath);
          return { buffer: existingBuffer, filename, filepath, invoiceRow };
        }
      }
    } catch (fsErr) {
      console.warn(`[PDF] Konnte bestehende Datei nicht prüfen: ${fsErr.message}`);
    }

    const tmpPath = `${filepath}.tmp-${Date.now()}`;
    try {
      fs.writeFileSync(tmpPath, pdfBuffer);
      try {
        fs.renameSync(tmpPath, filepath);
      } catch (renameErr) {
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(tmpPath);
          const finalBuf = fs.readFileSync(filepath);
          return { buffer: finalBuf, filename, filepath, invoiceRow };
        }
        throw renameErr;
      }
    } finally {
      if (fs.existsSync(tmpPath)) {
        try {
          fs.unlinkSync(tmpPath);
        } catch (cleanupErr) {
          console.warn(`[PDF] Tmp-Datei konnte nicht entfernt werden: ${cleanupErr.message}`);
        }
      }
    }

    return { buffer: pdfBuffer, filename, filepath, invoiceRow };
  } finally {
    // no-op
  }
}

function generateInvoiceHtml(
  invoice,
  formattedDate,
  formattedReceiptDate,
  itemsRowsHtml,
  sepaQrBase64,
  logoBase64ForInvoice,
  bankSettings,
  headerSettings
) {
  const formatIban = (iban) => {
    if (!iban) return "-";
    return iban.replace(/(.{4})/g, "$1 ").trim();
  };

  const bankDisplay = {
    account_holder: bankSettings?.account_holder || "-",
    bank_name: headerSettings?.bank_name || bankSettings?.bank_name || "-",
    iban: formatIban(headerSettings?.iban || bankSettings?.iban),
    bic: (headerSettings?.bic || bankSettings?.bic || "-").toUpperCase(),
  };

  const header = {
    company_name: headerSettings?.company_name || bankDisplay.account_holder || "RechnungsAPP",
    address_line1: headerSettings?.address_line1 || "",
    address_line2: headerSettings?.address_line2 || "",
    zip: headerSettings?.zip || "",
    city: headerSettings?.city || "",
    country: headerSettings?.country || "",
    vat_id: headerSettings?.vat_id || "",
    footer_text: headerSettings?.footer_text || "",
    logo_url: headerSettings?.logo_url || null,
  };

  const brandLines = [
    header.company_name,
    [header.address_line1, header.address_line2].filter(Boolean).join(", "),
    [header.zip, header.city].filter(Boolean).join(" "),
    header.country,
    header.vat_id ? `USt-IdNr.: ${header.vat_id}` : "",
  ].filter(Boolean);

  return `
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8" />
<title>RE-${invoice.invoice_number}</title>

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
    <img src="${header.logo_url ? header.logo_url : `data:image/png;base64,${logoBase64ForInvoice}`}" alt="Logo" />
    <div class="brand-sub">
      ${brandLines.join("<br>")}
    </div>
  </div>

  <div class="sender-line">
    ${[header.company_name, header.address_line1, header.address_line2, [header.zip, header.city].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}
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
        <tr><td>Zwischensumme</td><td><span class="amount">${formatCurrencyDe(invoice.net_19 + invoice.net_7)} €</span></td></tr>
        <tr><td>MwSt 19%</td><td><span class="amount">${formatCurrencyDe(invoice.vat_19)} €</span></td></tr>
        <tr><td>MwSt 7%</td><td><span class="amount">${formatCurrencyDe(invoice.vat_7)} €</span></td></tr>
      </table>

      <div class="final-total-box">
      <div class="final-total-value">
        <span class="amount">
          ${
            invoice.b2b
              ? `${formatCurrencyDe(invoice.net_19 + invoice.net_7)} € (Netto-Endbetrag)`
              : `${formatCurrencyDe(invoice.gross_total)} €`
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
      ${
        header.vat_id
          ? `USt-IdNr.: ${header.vat_id}<br>`
          : ""
      }
      Bank: ${bankDisplay.bank_name} · IBAN: ${bankDisplay.iban} · BIC: ${bankDisplay.bic}<br>
      Kontoinhaber: ${bankDisplay.account_holder}<br>
      ${header.footer_text || ""}
    </div>

</div>

</body>
</html>
  `;
}

export { generateInvoiceHtml };

/**
 * POST /api/invoices/:id/status/sent
 * Rechnung als versendet markieren
 */
export const markSent = async (req, res) => {
  const id = Number(req.params.id);

  if (!id) return res.status(400).json({ error: "Ungültige Rechnungs-ID" });

  try {
    const updated = await prisma.invoices.update({
      where: { id },
      data: {
        status_sent: true,
        status_sent_at: new Date(),
      },
      select: {
        id: true,
        invoice_number: true,
        reservation_request_id: true,
        status_sent_at: true,
        status_paid_at: true,
      },
    });

    if (!updated) {
      return res.status(404).json({ message: "Rechnung nicht gefunden" });
    }

    const row = updated;
    const firstItem = await fetchFirstItemDescription(id);

    // HKForms Sync (best effort, nicht blocking)
    sendHkformsStatus({
      reservationId: row.reservation_request_id,
      payload: {
        status: "SENT",
        reference: row.invoice_number,
        sentAt: row.status_sent_at || new Date(),
        firstItem,
      },
      endpoint: "invoices",
    });

    return res.json({ message: "Rechnung als versendet markiert" });
  } catch (err) {
    if (err?.code === "P2025") {
      return res.status(404).json({ message: "Rechnung nicht gefunden" });
    }
    console.error("Fehler beim Markieren als versendet:", err);
    return res.status(500).json({ error: "Fehler beim Aktualisieren des Status" });
  }
};

/**
 * GET /api/invoices/:id/email-preview
 * Liefert Betreff/Body (mit Platzhaltern ersetzt) sowie Absender-Info
 */
export const getInvoiceEmailPreview = async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: "Ungültige Rechnungs-ID" });

  try {
    const row = await loadInvoiceWithCategory(id);
    const bankSettings = await getBankSettings();
    const headerSettings = await getInvoiceHeaderSettings();
    const globalTemplate = await getGlobalEmailTemplate();
    const content = buildEmailContent(row, bankSettings, headerSettings, globalTemplate);
    const smtp = await resolveSmtpConfig(row);
    const datevSettings = await getDatevSettings();
    const datevEmail = (datevSettings?.email || "").trim();

    return res.json({
      subject: content.subject,
      body_html: content.bodyHtml,
      body_text: content.bodyText,
      template_used: content.templateUsed,
      category: content.category,
      from: smtp?.from || null,
      using_category_account: smtp?.usingCategoryAccount || false,
      smtp_ready: Boolean(smtp),
      datev_email: datevEmail || null,
      datev_configured: Boolean(datevEmail),
    });
  } catch (err) {
    if (err?.code === "NOT_FOUND") {
      return res.status(404).json({ message: "Rechnung nicht gefunden" });
    }
    console.error("Fehler beim E-Mail-Preview:", err);
    return res.status(500).json({ message: "E-Mail-Vorschau konnte nicht geladen werden." });
  }
};

/**
 * POST /api/invoices/:id/send-email
 * Rechnung per E-Mail mit PDF-Anhang versenden
 */
export const sendInvoiceEmail = async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: "Ungültige Rechnungs-ID" });

  const { to, subject, message, html, include_datev } = req.body || {};
  const email = (to || "").trim();
  const includeDatev = include_datev === true;
  const emailSendDisabled = ["1", "true", "yes"].includes(
    (process.env.EMAIL_SEND_DISABLED || "").toLowerCase()
  );
  const redirectTo = (process.env.EMAIL_REDIRECT_TO || "").trim();

  if (!email) {
    return res.status(400).json({ message: "E-Mail-Adresse fehlt." });
  }

  const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: "E-Mail-Adresse ist ungültig." });
  }

  try {
    await ensureDatevExportColumns();
    const { filename, filepath } = await ensureInvoicePdf(id);
    const row = await loadInvoiceWithCategory(id);
    const bankSettings = await getBankSettings();
    const headerSettings = await getInvoiceHeaderSettings();
    const globalTemplate = await getGlobalEmailTemplate();
    const content = buildEmailContent(row, bankSettings, headerSettings, globalTemplate);
    const smtpConfig = await resolveSmtpConfig(row);
    const datevSettings = includeDatev ? await getDatevSettings() : null;
    const datevEmail = includeDatev ? (datevSettings?.email || "").trim() : "";

    if (!smtpConfig) {
      return res.status(400).json({
        message:
          "Kein SMTP-Konto hinterlegt. Bitte ein Konto in der Kategorie oder unter Einstellungen → SMTP (oder via ENV) hinterlegen.",
      });
    }

    if (includeDatev && !datevEmail) {
      return res.status(400).json({
        message: "Keine DATEV-E-Mail hinterlegt. Bitte unter Einstellungen → DATEV speichern.",
      });
    }

    const emailSubject = (subject || "").trim() || content.subject;
    const htmlFromRequest = (html || "").trim();
    const htmlFromTemplate = content.bodyHtml || "";
    const rawHtml = ensureHtmlBody(
      htmlFromRequest || htmlFromTemplate,
      (message || "").trim() || content.bodyText
    );

    // Einheitliche Basis-Styles + White-Space, damit Zeilenumbrüche erhalten bleiben
    const emailHtml = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:14px; line-height:1.5; white-space:pre-line; color:#111;">
        ${rawHtml}
      </div>
    `;

    const emailText = stripHtmlToText(rawHtml) || content.bodyText || (message || "").trim();

    const recipients = buildDatevRecipients(email, datevEmail, includeDatev);
    const finalRecipients = redirectTo
      ? { to: redirectTo, includeDatev: false }
      : recipients;

    let mailSent = false;
    if (!emailSendDisabled) {
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure === true || smtpConfig.secure === "true",
        auth: {
          user: smtpConfig.authUser,
          pass: smtpConfig.authPass,
        },
      });

      await transporter.sendMail({
        from: smtpConfig.from,
        to: finalRecipients.to,
        // DATEV-Adresse als BCC, damit der Kunde die interne Export-Adresse nicht sieht.
        ...(finalRecipients.includeDatev ? { bcc: finalRecipients.bcc } : {}),
        subject: emailSubject,
        text: emailText,
        html: emailHtml,
        replyTo: smtpConfig.reply_to || undefined,
        attachments: [
          {
            filename,
            path: filepath,
            contentType: "application/pdf",
            contentDisposition: "attachment",
          },
        ],
      });
      mailSent = true;
    } else {
      console.log(
        `[MAIL] Versand unterdrückt (EMAIL_SEND_DISABLED). To=${finalRecipients.to}`
      );
    }

    let updatedRow = null;
    let firstItem = null;

    if (mailSent) {
      updatedRow = await prisma.invoices.update({
        where: { id },
        data: {
          status_sent: true,
          status_sent_at: new Date(),
        },
        select: {
          id: true,
          invoice_number: true,
          reservation_request_id: true,
          status_sent_at: true,
        },
      });
      firstItem = await fetchFirstItemDescription(id);
    }

    if (includeDatev && mailSent) {
      await updateDatevExportStatus(id, DATEV_STATUS.SENT, null);
    }

    const successMessage = mailSent
      ? includeDatev
        ? "E-Mail wurde verschickt (Kunde + DATEV)."
        : "E-Mail wurde verschickt."
      : "E-Mail-Versand deaktiviert (EMAIL_SEND_DISABLED). Keine Mail gesendet.";

    // HKForms Sync (best effort)
    if (mailSent) {
      sendHkformsStatus({
        reservationId: updatedRow?.reservation_request_id,
        payload: {
          status: "SENT",
          reference: updatedRow?.invoice_number || row.invoice_number,
          sentAt: updatedRow?.status_sent_at || new Date(),
          firstItem,
        },
        endpoint: "invoices",
      });
    }

    return res.json({ message: successMessage });
  } catch (err) {
    if (err?.code === "NOT_FOUND") {
      return res.status(404).json({ message: "Rechnung nicht gefunden" });
    }
    if (includeDatev) {
      try {
        await updateDatevExportStatus(id, DATEV_STATUS.FAILED, err?.message || "DATEV-Versand fehlgeschlagen.");
      } catch (statusErr) {
        console.error("DATEV-Status konnte nicht aktualisiert werden:", statusErr);
      }
    }
    console.error("Fehler beim E-Mail-Versand:", err);
    const msg =
      err?.code === "EAUTH"
        ? "SMTP-Login fehlgeschlagen. Zugangsdaten prüfen."
        : err?.message || "E-Mail konnte nicht versendet werden.";
    return res.status(500).json({ message: msg });
  }
};

/**
 * POST /api/invoices/:id/datev-export
 * Rechnung direkt an DATEV-E-Mail senden
 */
export const exportInvoiceToDatev = async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: "Ungültige Rechnungs-ID" });

  try {
    await ensureDatevExportColumns();
    const datevSettings = await getDatevSettings();
    const datevEmail = (datevSettings?.email || "").trim();

    if (!datevEmail) {
      await updateDatevExportStatus(id, DATEV_STATUS.SKIPPED, "Kein DATEV-Empfänger hinterlegt");
      return res.status(400).json({
        message: "Keine DATEV-E-Mail hinterlegt. Bitte unter Einstellungen → DATEV speichern.",
      });
    }

    const { filename, filepath } = await ensureInvoicePdf(id);
    const row = await loadInvoiceWithCategory(id);
    const bankSettings = await getBankSettings();
    const smtpConfig = await resolveSmtpConfig(row);

    if (!smtpConfig) {
      await updateDatevExportStatus(id, DATEV_STATUS.SKIPPED, "Kein SMTP-Konto verfügbar");
      return res.status(400).json({
        message: "Kein SMTP-Konto hinterlegt. Bitte Kategorie- oder Standard-SMTP konfigurieren.",
      });
    }

    const subject = buildDatevMailSubject(row.invoice_number);
    const bodyText = buildDatevMailBody(row, bankSettings);

    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure === true || smtpConfig.secure === "true",
      auth: {
        user: smtpConfig.authUser,
        pass: smtpConfig.authPass,
      },
    });

    await transporter.sendMail({
      from: smtpConfig.from,
      to: datevEmail,
      subject,
      text: bodyText,
      html: bodyText.replace(/\n/g, "<br>"),
      replyTo: smtpConfig.reply_to || undefined,
      attachments: [
        {
          filename,
          path: filepath,
          contentType: "application/pdf",
          contentDisposition: "attachment",
        },
      ],
    });

    await updateDatevExportStatus(id, DATEV_STATUS.SUCCESS, null);

    return res.json({ message: "Rechnung wurde an DATEV gesendet." });
  } catch (err) {
    if (err?.code === "NOT_FOUND") {
      return res.status(404).json({ message: "Rechnung nicht gefunden" });
    }
    console.error("DATEV Export fehlgeschlagen:", err);
    const short =
      err?.code === "EAUTH"
        ? "SMTP-Login fehlgeschlagen. Zugangsdaten prüfen."
        : err?.responseCode
        ? `SMTP-Fehler (${err.responseCode}): ${(err.response || err.message || "").split("\n")[0]}`
        : err?.message || "DATEV Export fehlgeschlagen.";
    await updateDatevExportStatus(id, DATEV_STATUS.FAILED, short);
    // 4xx/5xx differenziert, aber kein harter 500 bei bekannten SMTP-Fehlern
    const status = err?.responseCode ? 502 : 400;
    return res.status(status).json({ message: short });
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
    const updated = await prisma.invoices.update({
      where: { id },
      data: {
        status_paid_at: new Date(),
      },
      select: {
        id: true,
        invoice_number: true,
        reservation_request_id: true,
        status_sent_at: true,
        status_paid_at: true,
      },
    });

    if (!updated) {
      return res.status(404).json({ message: "Rechnung nicht gefunden" });
    }

    const row = updated;
    const firstItem = await fetchFirstItemDescription(id);

    // HKForms Sync (best effort)
    sendHkformsStatus({
      reservationId: row.reservation_request_id,
      payload: {
        status: "PAID",
        reference: row.invoice_number,
        sentAt: row.status_sent_at || null,
        paidAt: row.status_paid_at || new Date(),
        firstItem,
      },
      endpoint: "invoices",
    });

    return res.json({ message: "Rechnung als bezahlt markiert" });
  } catch (err) {
    if (err?.code === "P2025") {
      return res.status(404).json({ message: "Rechnung nicht gefunden" });
    }
    console.error("Fehler beim Markieren als bezahlt:", err);
    return res.status(500).json({ error: "Fehler beim Aktualisieren des Status" });
  }
};

const parseDateInput = (value, fieldName) => {
  if (value == null) return null;
  const date = new Date(value);
  if (isNaN(date)) {
    const error = new Error(`Ungültiges Datum für ${fieldName}`);
    error.code = "BAD_DATE";
    throw error;
  }
  return date;
};

export const getInvoiceStatusByReservation = async (req, res) => {
  const reservationId = (req.params.reservationId || "").trim();
  if (!reservationId) {
    return res.status(400).json({ message: "Reservation-ID fehlt." });
  }

  try {
    const row = await prisma.invoices.findFirst({
      where: { reservation_request_id: reservationId },
      select: {
        id: true,
        invoice_number: true,
        reservation_request_id: true,
        status_sent: true,
        status_sent_at: true,
        status_paid_at: true,
        overdue_since: true,
        external_reference: true,
      },
    });

    if (!row) {
      return res.status(404).json({ message: "Rechnung nicht gefunden" });
    }

    return res.json({
      invoiceId: row.id,
      invoiceNumber: row.invoice_number,
      reservationRequestId: row.reservation_request_id,
      statusSent: row.status_sent,
      statusSentAt: row.status_sent_at,
      statusPaidAt: row.status_paid_at,
      overdueSince: row.overdue_since,
      reference: row.external_reference || null,
    });
  } catch (err) {
    console.error("Fehler beim Laden des Reservation-Status:", err);
    return res.status(500).json({ message: "Status konnte nicht geladen werden." });
  }
};

export const updateInvoiceStatusByReservation = async (req, res) => {
  const reservationId = (req.params.reservationId || "").trim();
  if (!reservationId) {
    return res.status(400).json({ message: "Reservation-ID fehlt." });
  }

  const { status, reference, sentAt, paidAt, overdueSince } = req.body || {};
  const normalizedStatus = (status || "").toUpperCase();
  const allowedStatuses = ["NONE", "SENT", "PAID", "OVERDUE"];

  if (!allowedStatuses.includes(normalizedStatus)) {
    return res.status(400).json({ message: "Ungültiger Status. Erlaubt: NONE, SENT, PAID, OVERDUE." });
  }

  let parsedSentAt = null;
  let parsedPaidAt = null;
  let parsedOverdueSince = null;
  const nowIso = new Date().toISOString();

  try {
    parsedSentAt = parseDateInput(sentAt, "sentAt");
    parsedPaidAt = parseDateInput(paidAt, "paidAt");
    parsedOverdueSince = parseDateInput(overdueSince, "overdueSince");
  } catch (err) {
    if (err?.code === "BAD_DATE") {
      return res.status(400).json({ message: err.message });
    }
    throw err;
  }

  try {
    const existing = await prisma.invoices.findFirst({
      where: { reservation_request_id: reservationId },
      select: {
        id: true,
        invoice_number: true,
        reservation_request_id: true,
        status_sent: true,
        status_sent_at: true,
        status_paid_at: true,
        overdue_since: true,
        external_reference: true,
      },
    });

    if (!existing) {
      return res.status(404).json({ message: "Rechnung nicht gefunden" });
    }

    const current = existing;

    let nextStatusSent = false;
    let nextStatusSentAt = null;
    let nextStatusPaidAt = null;
    let nextOverdueSince = null;

    switch (normalizedStatus) {
      case "SENT":
        nextStatusSent = true;
        nextStatusSentAt = parsedSentAt || current.status_sent_at || nowIso;
        nextStatusPaidAt = null;
        nextOverdueSince = null;
        break;
      case "PAID":
        nextStatusSent = true;
        nextStatusSentAt = parsedSentAt || current.status_sent_at || nowIso;
        nextStatusPaidAt = parsedPaidAt || current.status_paid_at || nowIso;
        nextOverdueSince = null;
        break;
      case "OVERDUE":
        nextStatusSent = true;
        nextStatusSentAt = parsedSentAt || current.status_sent_at || null;
        nextStatusPaidAt = null;
        nextOverdueSince = parsedOverdueSince || current.overdue_since || nowIso;
        break;
      default:
        // NONE
        nextStatusSent = false;
        nextStatusSentAt = null;
        nextStatusPaidAt = null;
        nextOverdueSince = null;
        break;
    }

    const nextReference = (reference || "").trim() || current.external_reference || null;

    const updated = await prisma.invoices.updateMany({
      where: { reservation_request_id: reservationId },
      data: {
        status_sent: nextStatusSent,
        status_sent_at: nextStatusSentAt,
        status_paid_at: nextStatusPaidAt,
        overdue_since: nextOverdueSince,
        external_reference: nextReference,
      },
    });

    if (updated.count === 0) {
      return res.status(404).json({ message: "Rechnung nicht gefunden" });
    }

    const row = {
      id: current.id,
      invoice_number: current.invoice_number,
      reservation_request_id: current.reservation_request_id,
      status_sent: nextStatusSent,
      status_sent_at: nextStatusSentAt,
      status_paid_at: nextStatusPaidAt,
      overdue_since: nextOverdueSince,
      external_reference: nextReference,
    };

    // HKForms Sync (best effort, nur wenn Reservation-ID vorhanden)
    let syncPayload = null;
    if (normalizedStatus === "SENT") {
      syncPayload = {
        status: "SENT",
        reference: row.invoice_number,
        sentAt: row.status_sent_at || new Date(),
      };
    } else if (normalizedStatus === "PAID") {
      syncPayload = {
        status: "PAID",
        reference: row.invoice_number,
        sentAt: row.status_sent_at || null,
        paidAt: row.status_paid_at || new Date(),
      };
    } else if (normalizedStatus === "OVERDUE") {
      syncPayload = {
        status: "OVERDUE",
        reference: row.invoice_number,
        overdueSince: row.overdue_since || new Date(),
      };
    }

    if (syncPayload) {
      const firstItem = await fetchFirstItemDescription(row.id);
      syncPayload.firstItem = firstItem || null;
      sendHkformsStatus({
        reservationId: row.reservation_request_id,
        payload: syncPayload,
        endpoint: "invoices",
      });
    }

    return res.json({
      invoiceId: row.id,
      invoiceNumber: row.invoice_number,
      reservationRequestId: row.reservation_request_id,
      statusSent: row.status_sent,
      statusSentAt: row.status_sent_at,
      statusPaidAt: row.status_paid_at,
      overdueSince: row.overdue_since,
      reference: row.external_reference || null,
    });
  } catch (err) {
    console.error("Fehler beim Aktualisieren des Reservation-Status:", err);
    return res.status(500).json({ message: "Status konnte nicht aktualisiert werden." });
  }
};

/**
 * POST /api/invoices/bulk-cancel
 * Mehrere Rechnungen stornieren (ohne Löschung)
 */
export const bulkCancelInvoices = async (req, res) => {
  const idsRaw = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const reasonRaw = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  const ids = Array.from(
    new Set(
      idsRaw
        .map((v) => Number(v))
        .filter((n) => Number.isInteger(n) && n > 0)
    )
  );

  if (!ids.length) {
    return res
      .status(400)
      .json({ message: "ids muss ein Array mit mindestens einem Element sein." });
  }

  const cancelReason = reasonRaw ? reasonRaw.slice(0, 500) : null;
  const now = new Date();

  try {
    const rows = await prisma.invoices.findMany({
      where: { id: { in: ids } },
      select: { id: true, invoice_number: true, canceled_at: true },
    });

    const toCancel = rows.filter((r) => !r.canceled_at);
    if (!toCancel.length) {
      return res.json({ updated: 0 });
    }

    const updated = await prisma.invoices.updateMany({
      where: { id: { in: toCancel.map((r) => r.id) }, canceled_at: null },
      data: {
        canceled_at: now,
        cancel_reason: cancelReason,
      },
    });

    await Promise.allSettled(
      toCancel.map((row) => moveInvoicePdfToArchive(row.invoice_number))
    );

    return res.json({ updated: updated.count || 0 });
  } catch (err) {
    console.error("Fehler beim Stornieren mehrerer Rechnungen:", err);
    return res.status(500).json({ message: "Rechnungen konnten nicht storniert werden." });
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

  try {
    const invoiceRow = await prisma.invoices.findUnique({
      where: { id },
      select: { invoice_number: true },
    });

    if (!invoiceRow) {
      return res.status(404).json({ error: "Rechnung nicht gefunden" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.invoice_items.deleteMany({
        where: { invoice_id: id },
      });
      await tx.invoices.delete({
        where: { id },
      });
    });

    // PDF-Datei (falls vorhanden) löschen
    try {
      const pdfDir = await getPdfDir();
      const filename = `Rechnung-${invoiceRow.invoice_number}.pdf`;
      const filepath = path.join(pdfDir, filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    } catch (err) {
      console.warn("Konnte PDF-Datei nicht löschen:", err.message);
    }

    return res.json({ message: "Rechnung gelöscht" });
  } catch (err) {
    console.error("Fehler beim Löschen der Rechnung:", err);
    if (err?.code === "P2025") {
      return res.status(404).json({ error: "Rechnung nicht gefunden" });
    }
    return res.status(500).json({ error: "Fehler beim Löschen der Rechnung" });
  }
};

/**
 * GET /api/invoices/recent?limit=10
 * Liefert die letzten Rechnungen (minimaler Satz Felder)
 */
export const getRecentInvoices = async (req, res) => {
  const limitRaw = Number(req.query.limit) || 10;
  const limit = Math.min(Math.max(limitRaw, 1), 50);
  try {
    const rows = await prisma.invoices.findMany({
      where: { canceled_at: null },
      orderBy: [
        { date: "desc" },
        { invoice_number: "desc" },
      ],
      take: limit,
      include: {
        recipients: { select: { name: true } },
      },
    });

    const categoryKeys = Array.from(
      new Set(rows.map((r) => r.category).filter(Boolean))
    );
    let categoryLabels = {};
    if (categoryKeys.length) {
      const cats = await prisma.invoice_categories.findMany({
        where: { key: { in: categoryKeys } },
        select: { key: true, label: true },
      });
      categoryLabels = Object.fromEntries(cats.map((c) => [c.key, c.label]));
    }

    const mapped = rows.map((r) => ({
      id: r.id,
      invoice_number: r.invoice_number,
      date: r.date,
      recipient_name: r.recipients?.name || null,
      category_label: r.category ? categoryLabels[r.category] || r.category : null,
      status_sent: r.status_sent,
      status_sent_at: r.status_sent_at,
      status_paid_at: r.status_paid_at,
      gross_total: r.gross_total,
    }));

    return res.json(mapped);
  } catch (err) {
    console.error("Fehler beim Laden der letzten Rechnungen:", err);
    return res.status(500).json({ message: "Letzte Rechnungen konnten nicht geladen werden." });
  }
};

// -------------------------------------------------------------
// 🔢 Automatische Rechnungsnummer im Format YYYYMM001
//    – pro Monat neu beginnend
// -------------------------------------------------------------
export const getNextInvoiceNumber = async (req, res) => {
  try {
    const next = await computeNextInvoiceNumber();
    return res.json({ next });
  } catch (err) {
    console.error("Fehler bei next-number:", err);
    return res
      .status(500)
      .json({ message: "Fehler beim Ermitteln der Rechnungsnummer" });
  }
};
