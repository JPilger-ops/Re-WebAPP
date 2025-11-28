import { db } from "../utils/db.js";

export const getAllCustomers = async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT id, name, street, zip, city, email, phone
      FROM recipients
      ORDER BY name ASC
      `
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fehler beim Laden der Kunden:", err);
    res.status(500).json({ error: "Fehler beim Abrufen der Kunden" });
  }
};

export const createCustomer = async (req, res) => {
  const { name, street, zip, city, email, phone } = req.body;

  if (!name) {
    return res.status(400).json({ message: "Name ist erforderlich" });
  }

  try {
    const result = await db.query(
      `
      INSERT INTO recipients (name, street, zip, city, email, phone)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
      `,
      [name, street, zip, city, email, phone]
    );

    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    console.error("Fehler beim Erstellen des Kunden:", err);
    res.status(500).json({ error: "Fehler beim Erstellen des Kunden" });
  }
};

export const updateCustomer = async (req, res) => {
  const id = Number(req.params.id);
  const { name, street, zip, city, email, phone } = req.body;

  if (!id) return res.status(400).json({ message: "Ungültige Kunden-ID" });

  try {
    await db.query(
      `
      UPDATE recipients
      SET name = $1,
          street = $2,
          zip = $3,
          city = $4,
          email = $5,
          phone = $6
      WHERE id = $7
      `,
      [name, street, zip, city, email, phone, id]
    );

    res.json({ message: "Kunde aktualisiert" });
  } catch (err) {
    console.error("Fehler beim Aktualisieren des Kunden:", err);
    res.status(500).json({ error: "Fehler beim Aktualisieren des Kunden" });
  }
};

export const deleteCustomer = async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: "Ungültige Kunden-ID" });

  try {
    // prüfen, ob noch Rechnungen existieren
    const invResult = await db.query(
      "SELECT COUNT(*)::int AS count FROM invoices WHERE recipient_id = $1",
      [id]
    );

    if (invResult.rows[0].count > 0) {
      return res.status(400).json({
        message: "Kunde kann nicht gelöscht werden, es existieren noch Rechnungen.",
      });
    }

    await db.query("DELETE FROM recipients WHERE id = $1", [id]);

    res.json({ message: "Kunde gelöscht" });
  } catch (err) {
    console.error("Fehler beim Löschen des Kunden:", err);
    res.status(500).json({ error: "Fehler beim Löschen des Kunden" });
  }
};