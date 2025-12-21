import { prisma } from "../utils/prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_TTL_HOURS = Number(process.env.AUTH_TOKEN_TTL_HOURS || 12);
const JWT_EXPIRES = `${JWT_TTL_HOURS}h`;
const isSecureRequest = (req) =>
  req?.secure || req?.get("x-forwarded-proto") === "https";

// Lockout / brute-force protection (simple in-memory)
const LOGIN_LOCK_THRESHOLD = Number(process.env.LOGIN_LOCKOUT_THRESHOLD || 10);
const LOGIN_LOCK_WINDOW_MS = Number(process.env.LOGIN_LOCKOUT_WINDOW_MS || 15 * 60 * 1000);
const LOGIN_LOCK_COOLDOWN_MS = Number(process.env.LOGIN_LOCKOUT_COOLDOWN_MS || LOGIN_LOCK_WINDOW_MS);
const failedLogins = new Map(); // key: username -> { count, firstTs, lockUntil }

function isLocked(username) {
  const entry = failedLogins.get(username);
  if (!entry) return false;
  if (entry.lockUntil && entry.lockUntil > Date.now()) return true;
  return false;
}

function registerFailure(username) {
  const now = Date.now();
  const entry = failedLogins.get(username) || { count: 0, firstTs: now, lockUntil: 0 };
  // reset window if expired
  if (entry.firstTs + LOGIN_LOCK_WINDOW_MS < now) {
    entry.count = 0;
    entry.firstTs = now;
  }
  entry.count += 1;
  if (entry.count >= LOGIN_LOCK_THRESHOLD) {
    entry.lockUntil = now + LOGIN_LOCK_COOLDOWN_MS;
  }
  failedLogins.set(username, entry);
}

function clearFailures(username) {
  failedLogins.delete(username);
}

const sameSiteFromEnv = () => {
  const value = (process.env.AUTH_COOKIE_SAMESITE || "lax").toLowerCase();
  if (["lax", "strict", "none"].includes(value)) return value;
  return "lax";
};

const buildCookieOptions = (req) => {
  const secureCookie = isSecureRequest(req);
  const sameSite = sameSiteFromEnv();

  return {
    httpOnly: true,
    sameSite,
    secure: secureCookie,
    path: "/",
    maxAge: JWT_TTL_HOURS * 60 * 60 * 1000,
    domain: process.env.COOKIE_DOMAIN || undefined,
  };
};

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
  const permRes = await prisma.role_permissions.findMany({
    where: { role_id: roleId },
    select: { permission_key: true },
  });
  return permRes.map((p) => p.permission_key);
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
    const roleRes = await prisma.roles.findUnique({
      where: { name: roleName }
    });

    if (!roleRes) {
      return res
        .status(400)
        .json({ message: `Rolle '${roleName}' existiert nicht.` });
    }

    const roleId = roleRes.id;
    const roleNameResolved = roleRes.name;

    // prüfen, ob Benutzername bereits vergeben
    const existing = await prisma.users.findUnique({
      where: { username },
      select: { id: true },
    });
    if (existing) {
      return res
        .status(409)
        .json({ message: "Benutzername ist bereits vergeben." });
    }

    const hash = await bcrypt.hash(password, 10);

    const user = await prisma.users.create({
      data: {
        username,
        password_hash: hash,
        role_id: roleId,
        is_active: true,
      },
      select: {
        id: true,
        username: true,
        role_id: true,
      }
    });

    // Permissions laden
    const permissions = await loadPermissionsForRole(user.role_id);

    const fullUser = {
      ...user,
      role_name: roleNameResolved,
      permissions,
    };

    const token = signToken(fullUser);

    res
      .cookie("token", token, buildCookieOptions(req))
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

    if (isLocked(username)) {
      return res.status(429).json({ message: "Zu viele Login-Versuche. Bitte später erneut versuchen." });
    }

    // Benutzer + Rolle laden
    const user = await prisma.users.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        password_hash: true,
        is_active: true,
        role_id: true,
        roles: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({ message: "Login fehlgeschlagen." });
    }

    if (user.is_active === false) {
      return res
        .status(403)
        .json({ message: "Benutzer ist deaktiviert." });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      registerFailure(username);
      return res.status(401).json({ message: "Login fehlgeschlagen." });
    }

    // Permissions laden
    const permissions = await loadPermissionsForRole(user.role_id);
    const roleName = user.roles?.name || null;

    const fullUser = {
      id: user.id,
      username: user.username,
      role_id: user.role_id,
      role_name: roleName,
      permissions,
    };

    const token = signToken(fullUser);
    clearFailures(username);

    res
      .cookie("token", token, buildCookieOptions(req))
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
    .clearCookie("token", { path: "/" })
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
    const userRecord = await prisma.users.findUnique({
      where: { id: userId },
      select: { password_hash: true },
    });

    if (!userRecord) {
      return res.status(404).json({ message: "Benutzer nicht gefunden." });
    }

    // Prüfen ob altes Passwort korrekt ist
    const ok = await bcrypt.compare(oldPassword, userRecord.password_hash);
    if (!ok) {
      return res.status(401).json({ message: "Altes Passwort ist falsch." });
    }

    // Neues Passwort speichern
    const hash = await bcrypt.hash(newPassword, 10);

    await prisma.users.update({
      where: { id: userId },
      data: { password_hash: hash },
    });

    res.json({ message: "Passwort erfolgreich geändert." });

  } catch (err) {
    console.error("Fehler bei changePassword:", err);
    res.status(500).json({ message: "Fehler beim Ändern des Passworts." });
  }
};
