import crypto from "crypto";
import { prisma } from "../utils/prisma.js";

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

// simple in-memory throttle for last_used_at updates (per key id)
const lastUsedCache = new Map(); // id -> timestamp ms
const LAST_USED_INTERVAL_MS = 10 * 60 * 1000; // 10 Minuten

export async function apiKeyAuth(req, res, next) {
  try {
    // Primär: X-API-Key; Bearer nur falls explizit gesetzt
    let apiKey = "";
    const headerKey = req.headers["x-api-key"];
    if (typeof headerKey === "string" && headerKey.trim()) {
      apiKey = headerKey.trim();
    } else if (
      typeof req.headers.authorization === "string" &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      apiKey = req.headers.authorization.slice(7).trim();
    }

    if (!apiKey) {
      return res
        .status(401)
        .json({ message: "API-Key erforderlich (Header X-API-Key oder Authorization: Bearer ...)." });
    }

    const incomingHash = sha256Hex(apiKey);
    const keyRow = await prisma.api_keys.findUnique({
      where: { key_hash: incomingHash },
    });

    if (!keyRow || keyRow.revoked_at) {
      return res.status(403).json({ message: "API-Key ungültig oder widerrufen." });
    }

    // timing-safe compare (redundant after lookup but keeps pattern consistent)
    const dbHash = keyRow.key_hash || "";
    if (dbHash.length !== incomingHash.length) {
      return res.status(403).json({ message: "API-Key ungültig oder widerrufen." });
    }
    const a = Buffer.from(dbHash, "hex");
    const b = Buffer.from(incomingHash, "hex");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(403).json({ message: "API-Key ungültig oder widerrufen." });
    }

    // Optional: scopes-Enforce später; aktuell nur durchreichen
    req.apiKey = {
      id: keyRow.id,
      name: keyRow.name,
      scopes: keyRow.scopes,
    };

    // Throttled last_used_at update
    const now = Date.now();
    const last = lastUsedCache.get(keyRow.id) || 0;
    if (now - last > LAST_USED_INTERVAL_MS) {
      lastUsedCache.set(keyRow.id, now);
      prisma.api_keys
        .update({
          where: { id: keyRow.id },
          data: { last_used_at: new Date() },
        })
        .catch(() => {});
    }

    return next();
  } catch (err) {
    console.error("API-Key-Auth Fehler:", err);
    return res.status(500).json({ message: "API-Key-Authentifizierung fehlgeschlagen." });
  }
}
