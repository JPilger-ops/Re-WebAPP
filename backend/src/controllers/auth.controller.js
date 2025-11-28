import { db } from "../utils/db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_EXPIRES = "12h";

/**
 * Hilfsfunktion: JWT erstellen
 * Wir speichern:
 *  - id
 *  - username
 *  - role_id
 *  - role_name
 *  - permissions (Array von Strings)
 */
function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role_id: user.role_id,
      role_name: user.role_name,
      permissions: user.permissions || [],
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

/**
 * Hilfsfunktion: alle Permissions zu einer role_id laden
 */
async function loadPermissionsForRole(roleId) {
  const permRes = await db.query(
    "SELECT permission_key FROM role_permissions WHERE role_id = $1",
    [roleId]
  );
  return permRes.rows.map((p) => p.permission_key);
}

/**
 * POST /api/auth/register
 * Benutzer anlegen (mit optionalem Create-PIN geschützt)
 *
 * Body:
 *  - username
 *  - password
 *  - role (optional, z.B. "admin" | "user" | "manager")
 *  - createPin (muss zu APP_CREATE_PIN passen, falls gesetzt)
 */
export const register = async (req, res) => {
  try {
    const { username, password, role, createPin } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Benutzername und Passwort sind erforderlich." });
    }

    // Create-PIN-Check (falls gesetzt)
    if (process.env.APP_CREATE_PIN) {
      if (!createPin || createPin !== process.env.APP_CREATE_PIN) {
        return res
          .status(403)
          .json({ message: "Ungültiger Erstell-PIN." });
      }
    }

    // Rolle auflösen
    const roleName = role || "user";
    const roleRes = await db.query(
      "SELECT id FROM roles WHERE name = $1",
      [roleName]
    );

    if (roleRes.rowCount === 0) {
      return res
        .status(400)
        .json({ message: `Rolle '${roleName}' existiert nicht.` });
    }

    const roleId = roleRes.rows[0].id;

    // prüfen, ob Benutzername bereits vergeben
    const existing = await db.query(
      "SELECT id FROM users WHERE username = $1",
      [username]
    );
    if (existing.rowCount > 0) {
      return res
        .status(409)
        .json({ message: "Benutzername ist bereits vergeben." });
    }

    const hash = await bcrypt.hash(password, 10);

    const result = await db.query(
      `INSERT INTO users (username, password_hash, role_id, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING id, username, role_id`,
      [username, hash, roleId]
    );

    const user = result.rows[0];

    // Permissions laden
    const permissions = await loadPermissionsForRole(user.role_id);

    const fullUser = {
      ...user,
      role_name: roleName,
      permissions,
    };

    const token = signToken(fullUser);

    res
      .cookie("token", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
        maxAge: 1000 * 60 * 60 * 12,
      })
      .json({
        message: "Registrierung erfolgreich.",
        user: {
          id: fullUser.id,
          username: fullUser.username,
          role_id: fullUser.role_id,
          role_name: fullUser.role_name,
          permissions: fullUser.permissions,
        },
      });
  } catch (err) {
    console.error("Fehler bei register:", err);
    res.status(500).json({ message: "Fehler bei der Registrierung." });
  }
};

/**
 * POST /api/auth/login
 * Username + Passwort → JWT-Cookie
 */
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Benutzername und Passwort sind erforderlich." });
    }

    // Benutzer + Rolle laden
    const result = await db.query(
      `SELECT 
         users.id,
         users.username,
         users.password_hash,
         users.is_active,
         users.role_id,
         roles.name AS role_name
       FROM users
       LEFT JOIN roles ON roles.id = users.role_id
       WHERE users.username = $1`,
      [username]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ message: "Login fehlgeschlagen." });
    }

    const user = result.rows[0];

    if (user.is_active === false) {
      return res
        .status(403)
        .json({ message: "Benutzer ist deaktiviert." });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ message: "Login fehlgeschlagen." });
    }

    // Permissions laden
    const permissions = await loadPermissionsForRole(user.role_id);

    const fullUser = {
      id: user.id,
      username: user.username,
      role_id: user.role_id,
      role_name: user.role_name,
      permissions,
    };

    const token = signToken(fullUser);

    res
      .cookie("token", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
        maxAge: 1000 * 60 * 60 * 12,
      })
      .json({
        message: "Login erfolgreich.",
        user: fullUser,
      });
  } catch (err) {
    console.error("Fehler bei login:", err);
    res.status(500).json({ message: "Fehler beim Login." });
  }
};

/**
 * POST /api/auth/logout
 * Cookie löschen
 */
export const logout = (req, res) => {
  res
    .clearCookie("token")
    .status(200)
    .json({ message: "Logout erfolgreich." });
};

/**
 * GET /api/auth/me
 * Aktuellen Benutzer (aus JWT) zurückgeben
 */
export const me = (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "Nicht eingeloggt." });
  }

  const user = req.user;

  res.json({
    id: user.id,
    username: user.username,
    role_id: user.role_id,
    role_name: user.role_name,
    permissions: user.permissions || [],
  });
};

/**
 * Alte Create-PIN-Route lassen wir vorerst bestehen,
 * falls du sie noch irgendwo nutzt.
 */
export const verifyCreatePin = (req, res) => {
  const { pin } = req.body;

  if (pin === process.env.APP_CREATE_PIN) {
    return res.status(200).json({ message: "Erstell-PIN korrekt" });
  }

  return res.status(401).json({ message: "Erstell-PIN falsch" });
};

export const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "Altes und neues Passwort erforderlich." });
    }

    // User laden
    const result = await db.query(
      "SELECT password_hash FROM users WHERE id = $1",
      [userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Benutzer nicht gefunden." });
    }

    const user = result.rows[0];

    // Prüfen ob altes Passwort korrekt ist
    const ok = await bcrypt.compare(oldPassword, user.password_hash);
    if (!ok) {
      return res.status(401).json({ message: "Altes Passwort ist falsch." });
    }

    // Neues Passwort speichern
    const hash = await bcrypt.hash(newPassword, 10);

    await db.query(
      "UPDATE users SET password_hash = $1 WHERE id = $2",
      [hash, userId]
    );

    res.json({ message: "Passwort erfolgreich geändert." });

  } catch (err) {
    console.error("Fehler bei changePassword:", err);
    res.status(500).json({ message: "Fehler beim Ändern des Passworts." });
  }
};