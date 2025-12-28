import { prisma } from "../utils/prisma.js";
import bcrypt from "bcrypt";

export const getUsers = async (req, res) => {
  try {
    const users = await prisma.users.findMany({
      select: {
        id: true,
        username: true,
        is_active: true,
        created_at: true,
        role_id: true,
        roles: { select: { name: true, id: true } },
      },
      orderBy: { id: "asc" },
    });

    const shaped = users.map((u) => ({
      id: u.id,
      username: u.username,
      is_active: u.is_active,
      created_at: u.created_at,
      role_name: u.roles?.name || null,
      role_id: u.roles?.id || u.role_id || null,
    }));

    res.json(shaped);
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
      const roleRes = await prisma.roles.findUnique({
        where: { name: "user" },
        select: { id: true },
      });
      finalRoleId = roleRes?.id;
    }

    const result = await prisma.users.create({
      data: {
        username,
        password_hash: hash,
        role_id: finalRoleId,
        is_active: true,
      },
      select: {
        id: true,
        username: true,
        role_id: true,
        is_active: true,
        created_at: true,
      },
    });

    res.json(result);

  } catch (err) {
    if (err.code === "P2002") {
      // UNIQUE violation
      return res.status(409).json({ message: "Benutzername existiert bereits." });
    }

    console.error("createUser error:", err);
    res.status(500).json({ message: "Interner Fehler beim Erstellen des Benutzers." });
  }
};

export const updateUser = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { username, role_id, is_active } = req.body;

    const result = await prisma.users.update({
      where: { id },
      data: {
        username,
        role_id,
        is_active,
      },
      select: {
        id: true,
        username: true,
        role_id: true,
        is_active: true,
        created_at: true,
      },
    });

    if (!result) {
      return res.status(404).json({ message: "Benutzer nicht gefunden." });
    }

    res.json(result);
  } 
  catch (err) {
  if (err.code === "P2002") {
    return res.status(409).json({ message: "Benutzername existiert bereits." });
  }

  res.status(500).json({ message: "Interner Serverfehler." });
}
};

export const resetUserPassword = async (req, res) => {
  try {
    const id = Number(req.params.id);

    // Neues Passwort generieren
    const newPlain = Math.random().toString(36).slice(-10);
    const hash = await bcrypt.hash(newPlain, 10);

    // Passwort aktualisieren
    const result = await prisma.users.update({
      where: { id },
      data: { password_hash: hash },
      select: { id: true, username: true },
    });

    if (!result) {
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
    await prisma.users.delete({
      where: { id: Number(req.params.id) },
    });
    res.json({ message: "Benutzer gelöscht." });
  } catch (err) {
    console.error("deleteUser error:", err);
    res.status(500).json({ message: "Fehler beim Löschen des Benutzers." });
  }
};
