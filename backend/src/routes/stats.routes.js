import { Router } from "express";
import { getInvoiceStats } from "../controllers/stats.controller.js";
import { requirePermission } from "../middleware/auth.middleware.js";

const router = Router();

router.get(
  "/invoices",
  requirePermission("stats.view"),
  getInvoiceStats
);

export default router;
