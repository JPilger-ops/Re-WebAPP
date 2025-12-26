import fs from "fs";
import path from "path";
import { getBankSettings, saveBankSettings } from "../utils/bankSettings.js";
import { getDatevSettings, saveDatevSettings, isValidEmail } from "../utils/datevSettings.js";
import { getHkformsSettings, saveHkformsSettings, resetHkformsSettingsCache } from "../utils/hkformsSettings.js";
import { getTaxSettings, saveTaxSettings } from "../utils/taxSettings.js";
import {
  getSmtpSettings,
  saveSmtpSettings,
  resolveGlobalSmtpFromDb,
  resolveGlobalSmtpFromEnv,
} from "../utils/smtpSettings.js";
import {
  getInvoiceHeaderSettings,
  saveInvoiceHeaderSettings,
} from "../utils/invoiceHeaderSettings.js";
import { getPdfSettings, savePdfSettings, testPdfPathWritable } from "../utils/pdfSettings.js";
import { getGlobalEmailTemplate, saveGlobalEmailTemplate } from "../utils/emailTemplates.js";
import { getFaviconSettings, saveFavicon, resetFavicon, resolveFaviconPath } from "../utils/favicon.js";
import { getNetworkSettings, saveNetworkSettings, getAllowedOrigins, getEffectiveTrustProxy } from "../utils/networkSettings.js";
import nodemailer from "nodemailer";
import crypto from "crypto";
import { prisma } from "../utils/prisma.js";

const isValidBic = (bic) => /^[A-Z0-9]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test((bic || "").toUpperCase());

const isValidIban = (ibanRaw) => {
  const iban = (ibanRaw || "").replace(/\s+/g, "").toUpperCase();
  if (!iban || iban.length < 15 || iban.length > 34) return false;
  if (!/^[A-Z0-9]+$/.test(iban)) return false;

  // Mod-97 Check
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const converted = rearranged
    .split("")
    .map((ch) => (/\d/.test(ch) ? ch : (ch.charCodeAt(0) - 55).toString()))
    .join("");

  let remainder = 0;
  for (const digit of converted) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }

  return remainder === 1;
};

export const getBankData = async (_req, res) => {
  try {
    const settings = await getBankSettings();
    return res.json(settings);
  } catch (err) {
    console.error("Bankdaten laden fehlgeschlagen:", err);
    return res.status(500).json({ message: "Bankdaten konnten nicht geladen werden." });
  }
};

export const updateBankData = async (req, res) => {
  try {
    const { account_holder, bank_name, iban, bic } = req.body || {};
    const errors = [];

    if (!account_holder || !account_holder.trim()) errors.push("Kontoinhaber fehlt.");
    if (!bank_name || !bank_name.trim()) errors.push("Bankname fehlt.");
    if (!iban || !iban.toString().trim()) errors.push("IBAN fehlt.");
    if (!bic || !bic.toString().trim()) errors.push("BIC fehlt.");

    const ibanClean = (iban || "").replace(/\s+/g, "").toUpperCase();
    const bicClean = (bic || "").replace(/\s+/g, "").toUpperCase();

    if (ibanClean && !isValidIban(ibanClean)) errors.push("IBAN ist ungültig.");
    if (bicClean && !isValidBic(bicClean)) errors.push("BIC ist ungültig (8 oder 11 Zeichen).");

    if (errors.length) {
      return res.status(400).json({ message: errors.join(" ") });
    }

    const saved = await saveBankSettings({
      account_holder: account_holder.trim(),
      bank_name: bank_name.trim(),
      iban: ibanClean,
      bic: bicClean,
    });

    return res.json(saved);
  } catch (err) {
    console.error("Bankdaten speichern fehlgeschlagen:", err);
    const message = err?.userMessage || "Bankdaten konnten nicht gespeichert werden.";
    return res.status(500).json({ message });
  }
};

export const getDatevData = async (_req, res) => {
  try {
    const settings = await getDatevSettings();
    return res.json(settings);
  } catch (err) {
    console.error("DATEV-Einstellungen laden fehlgeschlagen:", err);
    return res.status(500).json({ message: "DATEV-Einstellungen konnten nicht geladen werden." });
  }
};

export const updateDatevData = async (req, res) => {
  try {
    const email = (req.body?.email || "").trim();

    if (!email) {
      return res.status(400).json({ message: "DATEV-E-Mail darf nicht leer sein." });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "DATEV-E-Mail ist ungültig." });
    }

    const saved = await saveDatevSettings({ email });
    return res.json(saved);
  } catch (err) {
    console.error("DATEV-Einstellungen speichern fehlgeschlagen:", err);
    const message = err?.userMessage || "DATEV-Einstellungen konnten nicht gespeichert werden.";
    return res.status(500).json({ message });
  }
};

export const downloadCaCertificate = async (_req, res) => {
  try {
    const certPath = path.resolve("certificates/ca/ca.crt");
    await fs.promises.access(certPath, fs.constants.R_OK);
    return res.download(certPath, "ca.crt");
  } catch (err) {
    if (err.code === "ENOENT") {
      return res.status(404).json({ message: "CA-Zertifikat nicht gefunden. Bitte certificates/ca/ca.crt hinterlegen." });
    }
    console.error("CA-Zertifikat kann nicht ausgeliefert werden:", err);
    return res.status(500).json({ message: "CA-Zertifikat nicht verfügbar." });
  }
};

export const getHkformsData = async (_req, res) => {
  try {
    const settings = await getHkformsSettings();
    const { api_key, ...rest } = settings || {};
    return res.json({
      ...rest,
      has_api_key: Boolean(api_key),
    });
  } catch (err) {
    console.error("HKForms-Einstellungen laden fehlgeschlagen:", err);
    return res.status(500).json({ message: "HKForms-Einstellungen konnten nicht geladen werden." });
  }
};

export const updateHkformsData = async (req, res) => {
  try {
    const { base_url, organization, api_key } = req.body || {};
    const saved = await saveHkformsSettings({ base_url, organization, api_key });
    resetHkformsSettingsCache();
    const { api_key: _secret, ...rest } = saved || {};
    return res.json({
      ...rest,
      has_api_key: Boolean(saved?.api_key),
    });
  } catch (err) {
    console.error("HKForms-Einstellungen speichern fehlgeschlagen:", err);
    const message = err?.userMessage || "HKForms-Einstellungen konnten nicht gespeichert werden.";
    const status = err?.statusCode || 500;
    return res.status(status).json({ message });
  }
};

export const getPdfSettingsData = async (_req, res) => {
  try {
    const settings = await getPdfSettings();
    return res.json(settings);
  } catch (err) {
    console.error("PDF-Einstellungen laden fehlgeschlagen:", err);
    return res.status(500).json({ message: "PDF-Einstellungen konnten nicht geladen werden." });
  }
};

export const updatePdfSettingsData = async (req, res) => {
  try {
    const path = (req.body?.storage_path || "").trim();
    const saved = await savePdfSettings({ storage_path: path });
    return res.json({ ...saved, message: "PDF-Einstellungen gespeichert." });
  } catch (err) {
    console.error("PDF-Einstellungen speichern fehlgeschlagen:", err);
    return res.status(500).json({ message: "PDF-Einstellungen konnten nicht gespeichert werden." });
  }
};

export const testPdfPath = async (req, res) => {
  try {
    const path = req.body?.path || req.body?.storage_path || "";
    const resolved = await testPdfPathWritable(path);
    return res.json({ ok: true, path: resolved });
  } catch (err) {
    const message = err?.message || "Pfad konnte nicht geschrieben werden.";
    return res.status(400).json({ message });
  }
};

export const testHkformsConnection = async (req, res) => {
  try {
    const incoming = req.body || {};
    const stored = await getHkformsSettings();

    const base_url = (incoming.base_url || stored.base_url || "").trim();
    const organization = (incoming.organization || stored.organization || "").trim();
    const api_key = (incoming.api_key || stored.api_key || "").trim();

    if (!base_url || !/^https?:\/\//i.test(base_url)) {
      return res.status(400).json({ message: "Bitte eine gültige Basis-URL angeben (http/https)." });
    }
    if (!api_key) {
      return res.status(400).json({ message: "Bitte einen API-Schlüssel angeben." });
    }

    const headers = {
      "X-HKFORMS-CRM-TOKEN": api_key,
      "Content-Type": "application/json",
    };
    if (organization) headers["X-HKFORMS-ORG"] = organization;

    const candidates = [`${base_url}/ping`, `${base_url}/health`, base_url];
    let lastError = null;

    for (const url of candidates) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const resp = await fetch(url, { method: "GET", headers, signal: controller.signal }).catch((err) => {
          throw err;
        });
        clearTimeout(timeout);
        const text = await resp.text().catch(() => "");

        // Erfolg bei 2xx oder "erreichbar" bei gängigen 4xx (Auth/NotFound/Method)
        if (resp.ok || [401, 403, 404, 405].includes(resp.status)) {
          return res.json({
            ok: true,
            status: resp.status,
            url,
            message: resp.ok ? "Verbindung erfolgreich." : "Server erreichbar.",
            response: text?.slice(0, 300) || null,
          });
        }

        lastError = { status: resp.status, url, body: text?.slice(0, 300) || "" };
      } catch (err) {
        lastError = { message: err?.message || "Verbindungsfehler" };
      }
    }

    return res.status(502).json({
      message: "HKForms-Verbindung fehlgeschlagen.",
      details: lastError,
    });
  } catch (err) {
    console.error("HKForms-Test fehlgeschlagen:", err);
    return res.status(500).json({ message: "HKForms-Test fehlgeschlagen." });
  }
};

export const getEmailTemplates = async (_req, res) => {
  try {
    const tmpl = await getGlobalEmailTemplate();
    return res.json({
      subject_template: tmpl?.subject_template || "",
      body_html_template: tmpl?.body_html_template || "",
      body_text_template: tmpl?.body_text_template || "",
      updated_at: tmpl?.updated_at || null,
    });
  } catch (err) {
    console.error("E-Mail-Templates laden fehlgeschlagen:", err);
    return res.status(500).json({ message: "E-Mail-Vorlagen konnten nicht geladen werden." });
  }
};

export const updateEmailTemplates = async (req, res) => {
  try {
    const subject = (req.body?.subject_template || "").trim();
    const bodyHtml = (req.body?.body_html_template || "").trim() || null;
    const bodyText = (req.body?.body_text_template || "").trim() || null;

    if (!subject) {
      return res.status(400).json({ message: "Betreff darf nicht leer sein." });
    }

    const saved = await saveGlobalEmailTemplate({
      subject_template: subject,
      body_html_template: bodyHtml,
      body_text_template: bodyText,
    });

    return res.json({
      subject_template: saved.subject_template || "",
      body_html_template: saved.body_html_template || "",
      body_text_template: saved.body_text_template || "",
      updated_at: saved.updated_at || null,
      message: "E-Mail-Vorlage gespeichert.",
    });
  } catch (err) {
    console.error("E-Mail-Templates speichern fehlgeschlagen:", err);
    return res.status(500).json({ message: "E-Mail-Vorlage konnte nicht gespeichert werden." });
  }
};

export const getFaviconData = async (_req, res) => {
  try {
    const settings = await getFaviconSettings();
    return res.json({
      filename: settings?.filename || null,
      updated_at: settings?.updated_at || null,
      url: `/favicon.ico${settings?.updated_at ? `?v=${new Date(settings.updated_at).getTime()}` : ""}`,
    });
  } catch (err) {
    console.error("Favicon laden fehlgeschlagen:", err);
    return res.status(500).json({ message: "Favicon konnte nicht geladen werden." });
  }
};

export const uploadFavicon = async (req, res) => {
  try {
    const { data_url } = req.body || {};
    if (!data_url || typeof data_url !== "string" || !data_url.startsWith("data:")) {
      return res.status(400).json({ message: "Ungültige Datei." });
    }
    const match = data_url.match(/^data:(.*?);base64,(.*)$/);
    if (!match) {
      return res.status(400).json({ message: "Ungültiges Datenformat." });
    }
    const mime = match[1];
    const base64 = match[2];
    const buffer = Buffer.from(base64, "base64");

    const saved = await saveFavicon({ buffer, mime });
    return res.json({
      ok: true,
      filename: saved.filename,
      updated_at: saved.updated_at,
      url: `/favicon.ico?v=${new Date(saved.updated_at).getTime()}`,
    });
  } catch (err) {
    const message = err?.message || "Upload fehlgeschlagen.";
    const status = err?.status || 500;
    console.error("Favicon Upload fehlgeschlagen:", err);
    return res.status(status).json({ message });
  }
};

export const resetFaviconHandler = async (_req, res) => {
  try {
    const saved = await resetFavicon();
    return res.json({
      ok: true,
      filename: saved.filename,
      updated_at: saved.updated_at,
      url: `/favicon.ico?v=${new Date(saved.updated_at).getTime()}`,
    });
  } catch (err) {
    console.error("Favicon Reset fehlgeschlagen:", err);
    return res.status(500).json({ message: "Favicon konnte nicht zurückgesetzt werden." });
  }
};

export const getNetworkSettingsData = async (_req, res) => {
  try {
    const settings = await getNetworkSettings();
    return res.json({
      cors_origins: settings.cors_origins || [],
      trust_proxy: settings.trust_proxy,
      updated_at: settings.updated_at || null,
    });
  } catch (err) {
    console.error("Netzwerk-Einstellungen laden fehlgeschlagen:", err);
    return res.status(500).json({ message: "Netzwerk-Einstellungen konnten nicht geladen werden." });
  }
};

export const updateNetworkSettingsData = async (req, res) => {
  try {
    const cors_origins = req.body?.cors_origins || req.body?.origins || [];
    const trust_proxy = req.body?.trust_proxy;
    const saved = await saveNetworkSettings({ cors_origins, trust_proxy });
    return res.json({
      ...saved,
      message: "Netzwerk-Einstellungen gespeichert.",
    });
  } catch (err) {
    console.error("Netzwerk-Einstellungen speichern fehlgeschlagen:", err);
    const status = err?.status || 500;
    return res.status(status).json({ message: err?.message || "Netzwerk-Einstellungen konnten nicht gespeichert werden." });
  }
};

export const networkDiagnostics = async (_req, res) => {
  try {
    const diagnostics = {
      api: true,
      db: false,
      pdf_path_writable: false,
      smtp_config_present: false,
      cors_effective: getAllowedOrigins(),
      trust_proxy_effective: getEffectiveTrustProxy(),
    };

    // DB check
    await prisma.$queryRaw`SELECT 1`;
    diagnostics.db = true;

    // PDF path
    try {
      const pdf = await getPdfSettings();
      const target = pdf?.storage_path || "/app/pdfs";
      const testFile = path.join(target, `.diag-${Date.now()}.tmp`);
      await fs.promises.mkdir(target, { recursive: true });
      await fs.promises.writeFile(testFile, "diag");
      await fs.promises.rm(testFile, { force: true });
      diagnostics.pdf_path_writable = true;
    } catch (err) {
      diagnostics.pdf_path_writable = false;
    }

    // SMTP present?
    try {
      const dbConfig = await resolveGlobalSmtpFromDb();
      const envConfig = resolveGlobalSmtpFromEnv();
      diagnostics.smtp_config_present = Boolean(dbConfig || envConfig);
    } catch {
      diagnostics.smtp_config_present = false;
    }

    return res.json(diagnostics);
  } catch (err) {
    console.error("Netzwerk-Diagnose fehlgeschlagen:", err);
    return res.status(500).json({ message: "Diagnose fehlgeschlagen." });
  }
};

export const getTaxData = async (_req, res) => {
  try {
    const settings = await getTaxSettings();
    return res.json(settings);
  } catch (err) {
    console.error("Steuer-Einstellungen laden fehlgeschlagen:", err);
    return res.status(500).json({ message: "Steuer-Einstellungen konnten nicht geladen werden." });
  }
};

export const updateTaxData = async (req, res) => {
  try {
    const { tax_number, vat_id } = req.body || {};
    const saved = await saveTaxSettings({ tax_number, vat_id });
    return res.json(saved);
  } catch (err) {
    console.error("Steuer-Einstellungen speichern fehlgeschlagen:", err);
    const message = err?.userMessage || "Steuer-Einstellungen konnten nicht gespeichert werden.";
    const status = err?.statusCode || 500;
    return res.status(status).json({ message });
  }
};

export const getSmtpData = async (_req, res) => {
  try {
    const settings = await getSmtpSettings();
    return res.json(settings || { has_password: false });
  } catch (err) {
    console.error("SMTP-Einstellungen laden fehlgeschlagen:", err);
    return res.status(500).json({ message: "SMTP-Einstellungen konnten nicht geladen werden." });
  }
};

export const updateSmtpData = async (req, res) => {
  try {
    const {
      host,
      port,
      secure,
      user,
      from,
      reply_to,
      password,
    } = req.body || {};

    const errors = [];
    const parsedPort = port ? Number(port) : null;
    if (port !== undefined && (Number.isNaN(parsedPort) || parsedPort <= 0)) {
      errors.push("SMTP-Port ist ungültig.");
    }
    if (host !== undefined && !host) errors.push("SMTP-Host darf nicht leer sein.");
    if (user !== undefined && !user) errors.push("SMTP-Benutzer darf nicht leer sein.");
    if (from !== undefined && !from) errors.push("Absender (FROM) darf nicht leer sein.");
    if (errors.length) {
      return res.status(400).json({ message: errors.join(" ") });
    }

    const saved = await saveSmtpSettings({
      host: host?.trim() || null,
      port: parsedPort,
      secure,
      user: user?.trim() || null,
      pass_value: password !== undefined ? password : undefined,
      from: from?.trim() || null,
      reply_to: reply_to?.trim() || null,
    });

    return res.json({ message: "SMTP-Einstellungen gespeichert.", ...saved });
  } catch (err) {
    console.error("SMTP-Einstellungen speichern fehlgeschlagen:", err);
    return res.status(500).json({ message: "SMTP-Einstellungen konnten nicht gespeichert werden." });
  }
};

export const testSmtpSettings = async (req, res) => {
  try {
    const emailSendDisabled = ["1", "true", "yes"].includes(
      (process.env.EMAIL_SEND_DISABLED || "").toLowerCase()
    );
    const redirectTo = (process.env.EMAIL_REDIRECT_TO || "").trim();

    const toRaw = req.body?.to || "";
    const to = toRaw.trim();
    if (!to) return res.status(400).json({ message: "Bitte eine Zieladresse angeben." });
    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({ message: "E-Mail-Adresse ist ungültig." });
    }

    const dbConfig = await resolveGlobalSmtpFromDb();
    const envConfig = resolveGlobalSmtpFromEnv();
    const smtpConfig = dbConfig || envConfig;

    if (!smtpConfig) {
      return res.status(400).json({
        message:
          "Kein SMTP-Konto konfiguriert. Bitte in den SMTP-Einstellungen oder per ENV hinterlegen.",
      });
    }

    const finalRecipient = redirectTo || to;
    const dryRun = emailSendDisabled;

    if (!dryRun) {
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure === true,
        auth: {
          user: smtpConfig.authUser,
          pass: smtpConfig.authPass,
        },
      });

      await transporter.sendMail({
        from: smtpConfig.from,
        to: finalRecipient,
        subject: "SMTP Test",
        text: "Testnachricht aus den SMTP-Einstellungen.",
        replyTo: smtpConfig.reply_to || undefined,
      });
    }

    return res.json({
      ok: true,
      dry_run: dryRun,
      redirected: Boolean(redirectTo),
      to: finalRecipient,
      message: dryRun
        ? "E-Mail-Versand ist deaktiviert (EMAIL_SEND_DISABLED=1) – Dry-Run erfolgreich."
        : "Testmail erfolgreich gesendet.",
    });
  } catch (err) {
    console.error("SMTP-Test fehlgeschlagen:", err);
    return res.status(500).json({ message: "SMTP-Test fehlgeschlagen." });
  }
};

export const getInvoiceHeaderData = async (_req, res) => {
  try {
    const settings = await getInvoiceHeaderSettings();
    return res.json(settings);
  } catch (err) {
    console.error("Briefkopf-Einstellungen laden fehlgeschlagen:", err);
    return res.status(500).json({ message: "Briefkopf-Einstellungen konnten nicht geladen werden." });
  }
};

export const updateInvoiceHeaderData = async (req, res) => {
  try {
    const saved = await saveInvoiceHeaderSettings({
      company_name: req.body?.company_name?.trim() || null,
      address_line1: req.body?.address_line1?.trim() || null,
      address_line2: req.body?.address_line2?.trim() || null,
      zip: req.body?.zip?.trim() || null,
      city: req.body?.city?.trim() || null,
      country: req.body?.country?.trim() || null,
      vat_id: req.body?.vat_id?.trim() || null,
      bank_name: req.body?.bank_name?.trim() || null,
      iban: req.body?.iban?.trim() || null,
      bic: req.body?.bic?.trim() || null,
      footer_text: req.body?.footer_text?.trim() || null,
      logo_url: req.body?.logo_url?.trim() || null,
    });
    return res.json({ message: "Briefkopf-Einstellungen gespeichert.", ...saved });
  } catch (err) {
    console.error("Briefkopf-Einstellungen speichern fehlgeschlagen:", err);
    return res.status(500).json({ message: "Briefkopf-Einstellungen konnten nicht gespeichert werden." });
  }
};

// -------------- API Keys --------------
const sha256Hex = (value) => crypto.createHash("sha256").update(value).digest("hex");

const generateApiKeyValue = () => {
  const raw = crypto.randomBytes(32).toString("hex"); // 64 chars
  const prefix = raw.slice(0, 8);
  return { api_key: `rk_${raw}`, prefix };
};

export const listApiKeys = async (_req, res) => {
  try {
    const keys = await prisma.api_keys.findMany({
      orderBy: { created_at: "desc" },
    });
    return res.json(
      keys.map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.prefix,
        scopes: k.scopes,
        created_at: k.created_at,
        last_used_at: k.last_used_at,
        revoked_at: k.revoked_at,
      }))
    );
  } catch (err) {
    console.error("API-Keys laden fehlgeschlagen:", err);
    return res.status(500).json({ message: "API-Keys konnten nicht geladen werden." });
  }
};

export const createApiKey = async (req, res) => {
  try {
    const name = req.body?.name?.trim() || null;
    const scopes = req.body?.scopes ?? null;
    const { api_key, prefix } = generateApiKeyValue();
    const key_hash = sha256Hex(api_key);

    const saved = await prisma.api_keys.create({
      data: {
        name,
        prefix,
        key_hash,
        scopes,
      },
    });

    return res.json({
      id: saved.id,
      name: saved.name,
      prefix: saved.prefix,
      scopes: saved.scopes,
      created_at: saved.created_at,
      api_key, // nur einmalig
    });
  } catch (err) {
    console.error("API-Key erstellen fehlgeschlagen:", err);
    return res.status(500).json({ message: "API-Key konnte nicht erstellt werden." });
  }
};

export const rotateApiKey = async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: "Ungültige ID." });
  try {
    const existing = await prisma.api_keys.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "API-Key nicht gefunden." });

    await prisma.api_keys.update({
      where: { id },
      data: { revoked_at: new Date() },
    });

    const { api_key, prefix } = generateApiKeyValue();
    const key_hash = sha256Hex(api_key);
    const created = await prisma.api_keys.create({
      data: {
        name: existing.name,
        scopes: existing.scopes,
        prefix,
        key_hash,
      },
    });

    return res.json({
      id: created.id,
      name: created.name,
      prefix: created.prefix,
      scopes: created.scopes,
      created_at: created.created_at,
      api_key, // einmalig
    });
  } catch (err) {
    console.error("API-Key rotate fehlgeschlagen:", err);
    return res.status(500).json({ message: "API-Key konnte nicht rotiert werden." });
  }
};

export const revokeApiKey = async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: "Ungültige ID." });
  try {
    const existing = await prisma.api_keys.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "API-Key nicht gefunden." });
    await prisma.api_keys.update({
      where: { id },
      data: { revoked_at: new Date() },
    });
    return res.json({ message: "API-Key widerrufen." });
  } catch (err) {
    console.error("API-Key Revoke fehlgeschlagen:", err);
    return res.status(500).json({ message: "API-Key konnte nicht widerrufen werden." });
  }
};

export const deleteApiKey = async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: "Ungültige ID." });
  try {
    const existing = await prisma.api_keys.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "API-Key nicht gefunden." });

    await prisma.api_keys.delete({ where: { id } });
    return res.json({ message: "API-Key gelöscht." });
  } catch (err) {
    console.error("API-Key löschen fehlgeschlagen:", err);
    return res.status(500).json({ message: "API-Key konnte nicht gelöscht werden." });
  }
};
