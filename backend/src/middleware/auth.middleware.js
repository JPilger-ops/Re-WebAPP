import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

if (JWT_SECRET === "dev-secret-change-me") {
  if ((process.env.NODE_ENV || "").toLowerCase() === "production") {
    throw new Error("JWT_SECRET ist nicht gesetzt. Bitte in der Umgebung konfigurieren.");
  } else {
    console.warn("[auth] WARN: JWT_SECRET fehlt, fallback 'dev-secret-change-me' wird genutzt (nur Dev geeignet).");
  }
}

/**
 * authRequired
 *  - Liest JWT aus Cookie "token" oder Authorization: Bearer
 *  - Verifiziert Token
 *  - Hängt Payload als req.user an
 */
export const authRequired = (req, res, next) => {
  const cookieToken = req.cookies?.token;
  const header = req.headers.authorization || "";
  const headerToken = header.startsWith("Bearer ")
    ? header.slice(7)
    : null;

  const token = cookieToken || headerToken;

  if (!token) {
  res.removeHeader("WWW-Authenticate");
  return res.status(401).json({ message: "Nicht eingeloggt." });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // payload: { id, username, role_id, role_name, permissions }
    req.user = payload;
    next();
  } catch (err) {
    console.error("JWT verify error:", err);
    res.removeHeader("WWW-Authenticate");
    return res
      .status(401)
      .json({ message: "Session abgelaufen oder ungültig." });
  }
};

/**
 * requireRole("admin")
 *  - einfache Rollenprüfung anhand role_name aus dem JWT
 */
export const requireRole = (roleName) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Nicht eingeloggt." });
  }
  const userRole = (req.user.role_name || "").toLowerCase();
  if (userRole !== String(roleName || "").toLowerCase()) {
    return res.status(403).json({ message: "Keine Berechtigung." });
  }
  next();
};

/**
 * requirePermission("invoices.read")
 *  - prüft, ob die permission im Array req.user.permissions vorhanden ist
 */
export const requirePermission = (perm) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Nicht eingeloggt." });
  }
  const perms = req.user.permissions || [];
  if (!perms.includes(perm)) {
    return res.status(403).json({ message: "Keine Berechtigung." });
  }
  next();
};

/**
 * requireHkformsToken
 *  - prüft Integrations-Token im Header X-HKFORMS-CRM-TOKEN
 *  - vergleicht gegen HKFORMS_SYNC_TOKEN aus der Umgebung
 */
export const requireHkformsToken = (req, res, next) => {
  const expected = (process.env.HKFORMS_SYNC_TOKEN || "").trim();
  const provided = (req.get("X-HKFORMS-CRM-TOKEN") || "").trim();

  if (!expected) {
    return res.status(401).json({ message: "Integration-Token fehlt." });
  }

  if (!provided || provided !== expected) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  next();
};
