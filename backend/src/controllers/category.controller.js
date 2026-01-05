import { db } from "../utils/db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ensureInvoiceCategoriesTable } from "../utils/categoryTable.js";
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import { ensureBrandingAssets } from "../utils/favicon.js";

const PUBLIC_DIR = path.resolve("public");
const logosDir = path.join(PUBLIC_DIR, "logos");
const MAX_LOGO_SIZE = 1.5 * 1024 * 1024; // 1.5 MB
const allowedLogoExt = [".png", ".jpg", ".jpeg", ".svg"];

const ensureLogosDir = () => {
  try {
    // Basisverzeichnis sicherstellen
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });

    // Wenn logosDir ein Symlink ist, Ziel auflösen und dort anlegen
    try {
      const stat = fs.lstatSync(logosDir);
      if (stat.isSymbolicLink()) {
        const target = fs.readlinkSync(logosDir);
        const absTarget = path.isAbsolute(target)
          ? target
          : path.join(path.dirname(logosDir), target);
        const insidePublic = absTarget.startsWith(PUBLIC_DIR);
        if (!insidePublic) {
          // Symlink zeigt nach außen -> entfernen und lokalen Ordner erzeugen
          try {
            fs.unlinkSync(logosDir);
          } catch {
            // ignore
          }
          fs.mkdirSync(logosDir, { recursive: true });
          return fs.realpathSync(logosDir);
        }
        fs.mkdirSync(path.dirname(absTarget), { recursive: true });
        fs.mkdirSync(absTarget, { recursive: true });
        return absTarget;
      }
    } catch {
      // ignore and fall through
    }

    fs.mkdirSync(path.dirname(logosDir), { recursive: true });
    fs.mkdirSync(logosDir, { recursive: true });
    const resolved = fs.realpathSync(logosDir);
    fs.mkdirSync(resolved, { recursive: true });
    return resolved;
  } catch (err) {
    console.warn("Konnte Logos-Verzeichnis nicht sicherstellen:", err.message);
    return logosDir;
  }
};

// Alle Kategorien holen
export const getAllCategories = async (req, res) => {
  try {
    await ensureInvoiceCategoriesTable();
    const result = await db.query(`
      SELECT
        c.id, c.key, c.label, c.logo_file, c.created_at, c.updated_at,
        ea.id               AS email_id,
        ea.display_name     AS email_display_name,
        ea.email_address    AS email_address,
        ea.smtp_host        AS email_smtp_host,
        ea.smtp_port        AS email_smtp_port,
        ea.smtp_secure      AS email_smtp_secure,
        ea.smtp_user        AS email_smtp_user,
        ea.updated_at       AS email_updated_at,
        t.id                AS tpl_id,
        t.subject           AS tpl_subject,
        t.body_text         AS tpl_body_text,
        t.updated_at        AS tpl_updated_at
      FROM invoice_categories c
      LEFT JOIN category_email_accounts ea ON ea.category_id = c.id
      LEFT JOIN category_templates t ON t.category_id = c.id
      ORDER BY c.label ASC
    `);

    const mapped = result.rows.map((row) => ({
      id: row.id,
      key: row.key,
      label: row.label,
      logo_file: row.logo_file,
      created_at: row.created_at,
      updated_at: row.updated_at,
      email_account: row.email_id
        ? {
            id: row.email_id,
            display_name: row.email_display_name,
            email_address: row.email_address,
            smtp_host: row.email_smtp_host,
            smtp_port: row.email_smtp_port,
            smtp_secure: row.email_smtp_secure,
            smtp_user: row.email_smtp_user,
            updated_at: row.email_updated_at,
          }
        : null,
      template: row.tpl_id
        ? {
            id: row.tpl_id,
            subject: row.tpl_subject,
            body_text: row.tpl_body_text,
            updated_at: row.tpl_updated_at,
          }
        : null,
    }));

    res.json(mapped);
  } catch (err) {
    console.error("Fehler beim Laden der Kategorien:", err);
    res.status(500).json({ message: "Fehler beim Laden der Kategorien" });
  }
};

// Kategorie erstellen
export const createCategory = async (req, res) => {
  const { key, label, logo_file } = req.body;

  const cleanKey = (key ?? "").trim();
  const cleanLabel = (label ?? "").trim();
  const cleanLogo = (logo_file ?? "").trim();

  if (!cleanKey || !cleanLabel || !cleanLogo) {
    return res.status(400).json({ message: "key, label und logo_file sind erforderlich." });
  }

  try {
    await ensureInvoiceCategoriesTable();
    const result = await db.query(
      `
      INSERT INTO invoice_categories (key, label, logo_file)
      VALUES ($1, $2, $3)
      RETURNING id, key, label, logo_file
      `,
      [cleanKey, cleanLabel, cleanLogo]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Fehler beim Erstellen der Kategorie:", err);
    if (err.code === "23505") {
      return res.status(409).json({ message: "Kategorie-Key existiert bereits." });
    }
    res.status(500).json({ message: "Fehler beim Erstellen der Kategorie" });
  }
};

// Kategorie aktualisieren
export const updateCategory = async (req, res) => {
  const id = Number(req.params.id);
  const { key, label, logo_file } = req.body;

  if (!id) return res.status(400).json({ message: "Ungültige Kategorien-ID." });

  const cleanKey = (key ?? "").trim();
  const cleanLabel = (label ?? "").trim();
  const cleanLogo = (logo_file ?? "").trim();

  if (!cleanKey || !cleanLabel) {
    return res.status(400).json({ message: "key und label sind erforderlich." });
  }

  try {
    await ensureInvoiceCategoriesTable();
    const result = await db.query(
      `
      UPDATE invoice_categories
      SET key = $1, label = $2, logo_file = $3, updated_at = NOW()
      WHERE id = $4
      RETURNING id, key, label, logo_file
      `,
      [cleanKey, cleanLabel, cleanLogo, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Kategorie nicht gefunden." });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Fehler beim Aktualisieren der Kategorie:", err);
    res.status(500).json({ message: "Fehler beim Aktualisieren der Kategorie" });
  }
};

// Kategorie löschen
export const deleteCategory = async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: "Ungültige Kategorien-ID." });

  try {
    await ensureInvoiceCategoriesTable();
    await db.query(
      "DELETE FROM invoice_categories WHERE id = $1",
      [id]
    );
    res.json({ message: "Kategorie gelöscht" });
  } catch (err) {
    console.error("Fehler beim Löschen der Kategorie:", err);
    res.status(500).json({ message: "Fehler beim Löschen der Kategorie" });
  }
};

const safeEmailAccount = (row = {}) => ({
  id: row.id || null,
  display_name: row.display_name || null,
  email_address: row.email_address || null,
  smtp_host: row.smtp_host || null,
  smtp_port: row.smtp_port || null,
  smtp_secure: row.smtp_secure ?? true,
  smtp_user: row.smtp_user || null,
  updated_at: row.updated_at || null,
});

export const getCategoryEmail = async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: "Ungültige Kategorien-ID." });

  try {
    const result = await db.query(
      `SELECT * FROM category_email_accounts WHERE category_id = $1`,
      [id]
    );
    if (result.rowCount === 0) return res.json(null);
    const row = result.rows[0];
    return res.json(safeEmailAccount(row));
  } catch (err) {
    console.error("E-Mail-Konto laden fehlgeschlagen:", err);
    return res.status(500).json({ message: "E-Mail-Konto konnte nicht geladen werden." });
  }
};

export const saveCategoryEmail = async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: "Ungültige Kategorien-ID." });

  const {
    display_name,
    email_address,
    smtp_host,
    smtp_port,
    smtp_secure = true,
    smtp_user,
    smtp_pass,
  } = req.body || {};

  if (!email_address) {
    return res.status(400).json({ message: "E-Mail-Adresse ist erforderlich." });
  }

  const hasSmtp = smtp_host && smtp_port && smtp_user && smtp_pass;
  if (!hasSmtp) {
    return res.status(400).json({ message: "Bitte SMTP Host, Port, User, Passwort angeben." });
  }
  const sp = Number(smtp_port);
  if (!Number.isInteger(sp) || sp < 1 || sp > 65535) {
    return res.status(400).json({ message: "SMTP Port ist ungültig." });
  }

  try {
    const existing = await db.query(
      `SELECT smtp_pass FROM category_email_accounts WHERE category_id = $1`,
      [id]
    );
    const prev = existing.rows[0] || {};
    const finalSmtpPass = smtp_pass || prev.smtp_pass || null;

    const result = await db.query(
      `
      INSERT INTO category_email_accounts (
        category_id, display_name, email_address,
        smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass,
        updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8, NOW()
      )
      ON CONFLICT (category_id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        email_address = EXCLUDED.email_address,
        smtp_host = EXCLUDED.smtp_host,
        smtp_port = EXCLUDED.smtp_port,
        smtp_secure = EXCLUDED.smtp_secure,
        smtp_user = EXCLUDED.smtp_user,
        smtp_pass = EXCLUDED.smtp_pass,
        updated_at = NOW()
      RETURNING *
      `,
      [
        id,
        display_name || null,
        email_address,
        smtp_host || null,
        Number(smtp_port),
        smtp_secure === false ? false : true,
        smtp_user || null,
        finalSmtpPass,
      ]
    );

    return res.json(safeEmailAccount(result.rows[0]));
  } catch (err) {
    console.error("E-Mail-Konto speichern fehlgeschlagen:", err);
    return res.status(500).json({ message: "E-Mail-Konto konnte nicht gespeichert werden." });
  }
};

export const testCategoryEmail = async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: "Ungültige Kategorien-ID." });

  const payload = req.body || {};
  try {
    // hole gespeicherte Daten als Fallback
    const existingRes = await db.query(
      `SELECT * FROM category_email_accounts WHERE category_id = $1`,
      [id]
    );
    const existing = existingRes.rows[0] || {};

    const data = {
      display_name: payload.display_name ?? existing.display_name,
      email_address: payload.email_address ?? existing.email_address,
      imap_host: payload.imap_host ?? existing.imap_host,
      imap_port: Number(payload.imap_port ?? existing.imap_port),
      imap_secure: payload.imap_secure ?? existing.imap_secure ?? true,
      imap_user: payload.imap_user ?? existing.imap_user,
      imap_pass: payload.imap_pass ?? existing.imap_pass,
      smtp_host: payload.smtp_host ?? existing.smtp_host,
      smtp_port: payload.smtp_port ? Number(payload.smtp_port) : existing.smtp_port,
      smtp_secure: payload.smtp_secure ?? existing.smtp_secure ?? true,
      smtp_user: payload.smtp_user ?? existing.smtp_user,
      smtp_pass: payload.smtp_pass ?? existing.smtp_pass,
    };

    const hasSmtp = data.smtp_host && data.smtp_port && data.smtp_user && data.smtp_pass;
    if (!hasSmtp) {
      return res.status(400).json({ ok: false, message: "Bitte SMTP-Daten angeben." });
    }

    try {
      const transport = nodemailer.createTransport({
        host: data.smtp_host,
        port: Number(data.smtp_port),
        secure: data.smtp_secure === false ? false : true,
        auth: {
          user: data.smtp_user,
          pass: data.smtp_pass,
        },
      });
      await transport.verify();
    } catch (smtpErr) {
      console.error("SMTP-Test fehlgeschlagen:", smtpErr);
      const msg = smtpErr?.code === "EAUTH"
        ? "SMTP-Login fehlgeschlagen: Benutzer/Passwort prüfen."
        : `SMTP fehlgeschlagen: ${smtpErr.message}`;
      return res.status(400).json({ ok: false, message: msg });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("E-Mail-Test fehlgeschlagen:", err);
    return res.status(500).json({ ok: false, message: "Test fehlgeschlagen." });
  }
};

export const getCategoryTemplate = async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: "Ungültige Kategorien-ID." });

  try {
    const result = await db.query(
      `SELECT id, category_id, subject, body_text, updated_at FROM category_templates WHERE category_id = $1`,
      [id]
    );
    if (result.rowCount === 0) return res.json(null);
    return res.json(result.rows[0]);
  } catch (err) {
    console.error("Template laden fehlgeschlagen:", err);
    return res.status(500).json({ message: "Template konnte nicht geladen werden." });
  }
};

export const saveCategoryTemplate = async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: "Ungültige Kategorien-ID." });

  const { subject, body_text } = req.body || {};
  const cleanSubject = (subject || "").trim();
  const cleanBody = (body_text || "").trim();
  if (!cleanSubject || !cleanBody) {
    return res.status(400).json({ message: "Subject und Body sind erforderlich." });
  }

  try {
    const result = await db.query(
      `
      INSERT INTO category_templates (category_id, subject, body_text, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (category_id) DO UPDATE SET
        subject = EXCLUDED.subject,
        body_text = EXCLUDED.body_text,
        body_html = NULL,
        updated_at = NOW()
      RETURNING id, category_id, subject, body_text, updated_at
      `,
      [id, cleanSubject, cleanBody]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error("Template speichern fehlgeschlagen:", err);
    return res.status(500).json({ message: "Template konnte nicht gespeichert werden." });
  }
};
// Logo-Upload (Base64 über JSON)
export const uploadLogo = async (req, res) => {
  try {
    await ensureBrandingAssets();
    const targetDir = ensureLogosDir();

    const { filename, dataUrl } = req.body || {};
    if (!filename || !dataUrl) {
      return res.status(400).json({ message: "filename und dataUrl sind erforderlich." });
    }

    const safeName = filename.split(/[/\\]/).pop().replace(/[^a-zA-Z0-9._-]/g, "");
    if (!safeName) {
      return res.status(400).json({ message: "Dateiname ist ungültig." });
    }

    const ext = path.extname(safeName).toLowerCase();
    if (!allowedLogoExt.includes(ext)) {
      return res.status(400).json({ message: "Nur PNG, JPG oder SVG sind erlaubt." });
    }

    const match = dataUrl.match(/^data:[^;]+;base64,(.*)$/);
    if (!match) {
      return res.status(400).json({ message: "Ungültiges Datei-Format." });
    }

    const base64 = match[1];
    const buffer = Buffer.from(base64, "base64");

    if (buffer.length > MAX_LOGO_SIZE) {
      return res.status(400).json({ message: "Datei ist zu groß (max. 1.5 MB)." });
    }

    const targetPath = path.join(targetDir, safeName);
    fs.writeFileSync(targetPath, buffer);

    return res.json({ filename: safeName, size: buffer.length });
  } catch (err) {
    console.error("Fehler beim Logo-Upload:", err);
    return res.status(500).json({ message: "Logo konnte nicht gespeichert werden." });
  }
};

// Logos aus dem /public/logos Verzeichnis auflisten
export const listLogos = async (req, res) => {
  try {
    await ensureBrandingAssets();
    const targetDir = ensureLogosDir();

    const files = fs
      .readdirSync(targetDir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => allowedLogoExt.includes(path.extname(name).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }));

    return res.json(files);
  } catch (err) {
    console.error("Fehler beim Auflisten der Logos:", err);
    return res.status(500).json({ message: "Logos konnten nicht geladen werden." });
  }
};
