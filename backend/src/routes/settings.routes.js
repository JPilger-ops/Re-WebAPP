import { Router } from "express";
import { authRequired, requirePermission, requireRole } from "../middleware/auth.middleware.js";
import { getBankData, updateBankData, getDatevData, updateDatevData, downloadCaCertificate } from "../controllers/settings.controller.js";

const router = Router();

router.use(authRequired);

router.get(
  "/bank",
  requirePermission("settings.general"),
  getBankData
);

router.put(
  "/bank",
  requirePermission("settings.general"),
  updateBankData
);

router.get(
  "/datev",
  requirePermission("settings.general"),
  getDatevData
);

router.put(
  "/datev",
  requirePermission("settings.general"),
  updateDatevData
);

router.get(
  "/ca-cert",
  requireRole("admin"),
  downloadCaCertificate
);

export default router;
