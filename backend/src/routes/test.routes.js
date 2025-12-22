import { Router } from "express";
import { db } from "../utils/db.js";
import { apiKeyAuth } from "../middleware/apiKey.middleware.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const result = await db.query("SELECT NOW()");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB Fehler" });
  }
});

if (process.env.NODE_ENV !== "production") {
  router.get("/api-key-test", apiKeyAuth, (_req, res) => {
    res.json({ ok: true, message: "API-Key gültig." });
  });

  // HKForms Mock: sammelt Requests und stellt Log bereit (DEV only)
  let hkformsLog = [];
  const MAX_LOG = 50;

  router.post("/hkforms-mock/*", (req, res) => {
    const entry = {
      time: new Date().toISOString(),
      path: req.path,
      headers: {
        "x-hkforms-crm-token": req.headers["x-hkforms-crm-token"] || null,
        "x-hkforms-org": req.headers["x-hkforms-org"] || null,
      },
      body: req.body || null,
    };
    hkformsLog.unshift(entry);
    if (hkformsLog.length > MAX_LOG) hkformsLog = hkformsLog.slice(0, MAX_LOG);
    res.json({ ok: true });
  });

  router.get("/hkforms-mock/log", (_req, res) => {
    res.json(hkformsLog);
  });
}

export default router;
