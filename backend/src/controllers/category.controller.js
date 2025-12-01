import { db } from "../utils/db.js";

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