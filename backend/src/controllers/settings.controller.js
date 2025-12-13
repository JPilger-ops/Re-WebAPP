import fs from "fs";
import path from "path";
import { getBankSettings, saveBankSettings } from "../utils/bankSettings.js";
import { getDatevSettings, saveDatevSettings, isValidEmail } from "../utils/datevSettings.js";

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
    console.error("CA-Zertifikat kann nicht ausgeliefert werden:", err);
    return res.status(500).json({ message: "CA-Zertifikat nicht verfügbar." });
  }
};
