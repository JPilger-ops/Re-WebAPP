import { Router } from "express";
import { db } from "../utils/db.js";

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

export default router;