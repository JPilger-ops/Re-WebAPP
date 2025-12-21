import crypto from "crypto";
import { prisma } from "../utils/prisma.js";

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function apiKeyAuth(req, res, next) {
  try {
    const headerKey =
      req.headers["x-api-key"] ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : null);

    const apiKey = typeof headerKey === "string" ? headerKey.trim() : "";
    if (!apiKey) {
      return res.status(401).json({ message: "API-Key erforderlich (Header X-API-Key oder Authorization: Bearer ...)." });
    }

    const hash = sha256Hex(apiKey);
    const keyRow = await prisma.api_keys.findUnique({
      where: { key_hash: hash },
    });

    if (!keyRow || keyRow.revoked_at) {
      return res.status(403).json({ message: "API-Key ungültig oder widerrufen." });
    }

    // Optional: scopes-Check hier später erweitern
    req.apiKey = {
      id: keyRow.id,
      name: keyRow.name,
      scopes: keyRow.scopes,
    };

    // best effort last_used_at update (no need to await)
    prisma.api_keys
      .update({
        where: { id: keyRow.id },
        data: { last_used_at: new Date() },
      })
      .catch(() => {});

    return next();
  } catch (err) {
    console.error("API-Key-Auth Fehler:", err);
    return res.status(500).json({ message: "API-Key-Authentifizierung fehlgeschlagen." });
  }
}
