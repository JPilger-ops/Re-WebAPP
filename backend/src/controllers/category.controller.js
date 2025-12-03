import { db } from "../utils/db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logosDir = path.join(__dirname, "../../public/logos");
const MAX_LOGO_SIZE = 1.5 * 1024 * 1024; // 1.5 MB
const allowedLogoExt = [".png", ".jpg", ".jpeg", ".svg"];

// Alle Kategorien holen
export const getAllCategories = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, key, label, logo_file
      FROM invoice_categories
      ORDER BY label ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Fehler beim Laden der Kategorien:", err);
    res.status(500).json({ message: "Fehler beim Laden der Kategorien" });
  }
};

// Kategorie erstellen
export const createCategory = async (req, res) => {
  const { key, label, logo_file } = req.body;

  if (!key || !label || !logo_file) {
    return res.status(400).json({ message: "key, label und logo_file sind erforderlich." });
  }

  try {
    const result = await db.query(
      `
      INSERT INTO invoice_categories (key, label, logo_file)
      VALUES ($1, $2, $3)
      RETURNING id, key, label, logo_file
      `,
      [key.trim(), label.trim(), logo_file.trim()]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Fehler beim Erstellen der Kategorie:", err);
    res.status(500).json({ message: "Fehler beim Erstellen der Kategorie" });
  }
};

// Kategorie aktualisieren
export const updateCategory = async (req, res) => {
  const id = Number(req.params.id);
  const { key, label, logo_file } = req.body;

  if (!id) return res.status(400).json({ message: "Ungültige Kategorien-ID." });

  try {
    const result = await db.query(
      `
      UPDATE invoice_categories
      SET key = $1, label = $2, logo_file = $3
      WHERE id = $4
      RETURNING id, key, label, logo_file
      `,
      [key.trim(), label.trim(), logo_file.trim(), id]
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

// Logo-Upload (Base64 über JSON)
export const uploadLogo = async (req, res) => {
  try {
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

    if (!fs.existsSync(logosDir)) {
      fs.mkdirSync(logosDir, { recursive: true });
    }

    const targetPath = path.join(logosDir, safeName);
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
    if (!fs.existsSync(logosDir)) {
      return res.json([]);
    }

    const files = fs
      .readdirSync(logosDir, { withFileTypes: true })
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
