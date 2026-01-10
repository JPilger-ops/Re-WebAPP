import { prisma } from "../utils/prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { getAuthCookieSameSite, getAuthTokenTtlMinutes } from "../utils/networkSettings.js";
import { generateMfaSecret, verifyMfaToken } from "../utils/mfa.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
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

const buildCookieOptions = (req) => {
  const secureCookie = isSecureRequest(req);
  const sameSite = getAuthCookieSameSite() || "lax";
  const ttlMinutes = getAuthTokenTtlMinutes();

  return {
    httpOnly: true,
    sameSite,
    secure: secureCookie,
    path: "/",
    maxAge: ttlMinutes * 60 * 1000,
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
  const ttlMinutes = getAuthTokenTtlMinutes();
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role_id: user.role_id,
      role_name: user.role_name,
      permissions: user.permissions || [],
    },
    JWT_SECRET,
    { expiresIn: `${ttlMinutes}m` }
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
      mfa_enabled: false,
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
          mfa_enabled: fullUser.mfa_enabled,
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
    const { username, password, otp } = req.body;

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
        mfa_enabled: true,
        mfa_secret: true,
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

    let mfaEnabled = Boolean(user.mfa_enabled);
    if (mfaEnabled && !user.mfa_secret) {
      console.warn(`[auth] MFA inkonsistent für ${user.username} (${user.id}). Deaktiviere MFA automatisch.`);
      try {
        await prisma.users.update({
          where: { id: user.id },
          data: { mfa_enabled: false, mfa_secret: null, mfa_temp_secret: null },
        });
      } catch (err) {
        console.error("MFA Auto-Disable fehlgeschlagen:", err);
      }
      mfaEnabled = false;
    }

    if (mfaEnabled) {
      if (!otp) {
        return res.status(401).json({ message: "MFA erforderlich.", mfa_required: true });
      }
      const otpOk = verifyMfaToken(user.mfa_secret, otp);
      if (!otpOk) {
        registerFailure(username);
        return res.status(401).json({ message: "MFA Code ungültig.", mfa_required: true });
      }
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
      mfa_enabled: mfaEnabled,
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
export const me = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "Nicht eingeloggt." });
  }

  const user = req.user;
  let mfaEnabled = false;
  try {
    const dbUser = await prisma.users.findUnique({
      where: { id: user.id },
      select: { mfa_enabled: true },
    });
    mfaEnabled = Boolean(dbUser?.mfa_enabled);
  } catch (err) {
    console.error("MFA Status konnte nicht geladen werden:", err);
  }

  res.json({
    id: user.id,
    username: user.username,
    role_id: user.role_id,
    role_name: user.role_name,
    permissions: user.permissions || [],
    mfa_enabled: mfaEnabled,
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

export const getMfaStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { mfa_enabled: true, mfa_temp_secret: true },
    });
    if (!user) return res.status(404).json({ message: "Benutzer nicht gefunden." });
    return res.json({ enabled: Boolean(user.mfa_enabled), pending: Boolean(user.mfa_temp_secret) });
  } catch (err) {
    console.error("MFA Status Fehler:", err);
    return res.status(500).json({ message: "MFA Status konnte nicht geladen werden." });
  }
};

export const startMfaSetup = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { username: true, mfa_enabled: true },
    });
    if (!user) return res.status(404).json({ message: "Benutzer nicht gefunden." });
    if (user.mfa_enabled) {
      return res.status(409).json({ message: "MFA ist bereits aktiviert." });
    }
    const setup = await generateMfaSecret(user.username);
    await prisma.users.update({
      where: { id: userId },
      data: { mfa_temp_secret: setup.secret, mfa_enabled: false },
    });
    return res.json(setup);
  } catch (err) {
    console.error("MFA Setup Fehler:", err);
    return res.status(500).json({ message: "MFA Setup fehlgeschlagen." });
  }
};

export const verifyMfaSetup = async (req, res) => {
  try {
    const userId = req.user.id;
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ message: "MFA Code fehlt." });
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { mfa_enabled: true, mfa_temp_secret: true },
    });
    if (!user) return res.status(404).json({ message: "Benutzer nicht gefunden." });
    if (user.mfa_enabled) {
      return res.status(409).json({ message: "MFA ist bereits aktiviert." });
    }
    if (!user.mfa_temp_secret) {
      return res.status(400).json({ message: "MFA Setup wurde noch nicht gestartet." });
    }
    const ok = verifyMfaToken(user.mfa_temp_secret, code);
    if (!ok) return res.status(401).json({ message: "MFA Code ungültig." });
    await prisma.users.update({
      where: { id: userId },
      data: { mfa_enabled: true, mfa_secret: user.mfa_temp_secret, mfa_temp_secret: null },
    });
    return res.json({ message: "MFA aktiviert." });
  } catch (err) {
    console.error("MFA Verify Fehler:", err);
    return res.status(500).json({ message: "MFA Aktivierung fehlgeschlagen." });
  }
};

export const disableMfa = async (req, res) => {
  try {
    const userId = req.user.id;
    const { password, code } = req.body || {};
    if (!password) return res.status(400).json({ message: "Passwort erforderlich." });
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { password_hash: true, mfa_enabled: true, mfa_secret: true },
    });
    if (!user) return res.status(404).json({ message: "Benutzer nicht gefunden." });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: "Passwort falsch." });
    if (user.mfa_enabled) {
      if (!code) return res.status(400).json({ message: "MFA Code erforderlich." });
      if (!user.mfa_secret || !verifyMfaToken(user.mfa_secret, code)) {
        return res.status(401).json({ message: "MFA Code ungültig." });
      }
    }
    await prisma.users.update({
      where: { id: userId },
      data: { mfa_enabled: false, mfa_secret: null, mfa_temp_secret: null },
    });
    return res.json({ message: "MFA deaktiviert." });
  } catch (err) {
    console.error("MFA Deaktivierung Fehler:", err);
    return res.status(500).json({ message: "MFA konnte nicht deaktiviert werden." });
  }
};

export const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { oldPassword, newPassword, currentPassword } = req.body;
    const oldPw = oldPassword || currentPassword;

    if (!oldPw || !newPassword) {
      return res.status(400).json({ message: "Altes und neues Passwort erforderlich." });
    }

    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return res.status(400).json({ message: "Neues Passwort muss mindestens 8 Zeichen lang sein." });
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
    const ok = await bcrypt.compare(oldPw, userRecord.password_hash);
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
