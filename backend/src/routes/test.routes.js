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

router.get("/api-key-test", apiKeyAuth, (_req, res) => {
  res.json({ ok: true, message: "API-Key gültig." });
});

export default router;
