import { db } from "../utils/db.js";
import bcrypt from "bcrypt";

export const getUsers = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        users.id,
        users.username,
        users.is_active,
        users.created_at,
        roles.name AS role_name,
        roles.id   AS role_id
      FROM users
      LEFT JOIN roles ON roles.id = users.role_id
      ORDER BY users.id ASC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("getUsers error:", err);
    res.status(500).json({ message: "Fehler beim Laden der Benutzer." });
  }
};

export const createUser = async (req, res) => {
  try {
    const { username, password, role_id } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Benutzername und Passwort erforderlich." });
    }

    const hash = await bcrypt.hash(password, 10);

    let finalRoleId = role_id;
    if (!finalRoleId) {
      const roleRes = await db.query("SELECT id FROM roles WHERE name = $1", ["user"]);
      finalRoleId = roleRes.rows[0].id;
    }

    const result = await db.query(
      `INSERT INTO users (username, password_hash, role_id, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING id, username, role_id, is_active, created_at`,
      [username, hash, finalRoleId]
    );

    res.json(result.rows[0]);

  } catch (err) {
    if (err.code === "23505") {
      // UNIQUE violation
      return res.status(409).json({ message: "Benutzername existiert bereits." });
    }

    console.error("createUser error:", err);
    res.status(500).json({ message: "Interner Fehler beim Erstellen des Benutzers." });
  }
};

export const updateUser = async (req, res) => {
  try {
    const id = req.params.id;
    const { username, role_id, is_active } = req.body;

    const result = await db.query(
      `UPDATE users
       SET username = $1,
           role_id  = $2,
           is_active = $3
       WHERE id = $4
       RETURNING id, username, role_id, is_active, created_at`,
      [username, role_id, is_active, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Benutzer nicht gefunden." });
    }

    res.json(result.rows[0]);
  } 
  catch (err) {
  if (err.code === "23505") {
    return res.status(409).json({ message: "Benutzername existiert bereits." });
  }

  res.status(500).json({ message: "Interner Serverfehler." });
}
};

export const resetUserPassword = async (req, res) => {
  try {
    const id = req.params.id;

    // Neues Passwort generieren
    const newPlain = Math.random().toString(36).slice(-10);
    const hash = await bcrypt.hash(newPlain, 10);

    // Passwort aktualisieren
    const result = await db.query(
      `UPDATE users
       SET password_hash = $1
       WHERE id = $2
       RETURNING id, username`,
      [hash, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Benutzer nicht gefunden." });
    }

    // Neues Passwort dem Admin zurückgeben
    res.json({
      message: "Passwort zurückgesetzt.",
      username: result.rows[0].username,
      newPassword: newPlain
    });

  } catch (err) {
    console.error("resetUserPassword error:", err);
    res.status(500).json({ message: "Fehler beim Zurücksetzen des Passworts." });
  }
};

export const deleteUser = async (req, res) => {
  try {
    await db.query("DELETE FROM users WHERE id = $1", [req.params.id]);
    res.json({ message: "Benutzer gelöscht." });
  } catch (err) {
    console.error("deleteUser error:", err);
    res.status(500).json({ message: "Fehler beim Löschen des Benutzers." });
  }
};