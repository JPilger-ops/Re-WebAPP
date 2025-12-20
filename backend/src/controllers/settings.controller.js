import fs from "fs";
import path from "path";
import { getBankSettings, saveBankSettings } from "../utils/bankSettings.js";
import { getDatevSettings, saveDatevSettings, isValidEmail } from "../utils/datevSettings.js";
import { getHkformsSettings, saveHkformsSettings } from "../utils/hkformsSettings.js";
import { getTaxSettings, saveTaxSettings } from "../utils/taxSettings.js";

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
    return res.json(settings);
  } catch (err) {
    console.error("HKForms-Einstellungen laden fehlgeschlagen:", err);
    return res.status(500).json({ message: "HKForms-Einstellungen konnten nicht geladen werden." });
  }
};

export const updateHkformsData = async (req, res) => {
  try {
    const { base_url, organization, api_key } = req.body || {};
    const saved = await saveHkformsSettings({ base_url, organization, api_key });
    return res.json(saved);
  } catch (err) {
    console.error("HKForms-Einstellungen speichern fehlgeschlagen:", err);
    const message = err?.userMessage || "HKForms-Einstellungen konnten nicht gespeichert werden.";
    const status = err?.statusCode || 500;
    return res.status(status).json({ message });
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
