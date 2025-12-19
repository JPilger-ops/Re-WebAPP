import { Router } from "express";
import { authRequired, requirePermission, requireRole } from "../middleware/auth.middleware.js";
import {
  getBankData,
  updateBankData,
  getDatevData,
  updateDatevData,
  downloadCaCertificate,
  getHkformsData,
  updateHkformsData,
  getTaxData,
  updateTaxData,
} from "../controllers/settings.controller.js";

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
  "/hkforms",
  requirePermission("settings.general"),
  getHkformsData
);

router.put(
  "/hkforms",
  requirePermission("settings.general"),
  updateHkformsData
);

router.get(
  "/tax",
  requirePermission("settings.general"),
  getTaxData
);

router.put(
  "/tax",
  requirePermission("settings.general"),
  updateTaxData
);

router.get(
  "/ca-cert",
  requireRole("admin"),
  downloadCaCertificate
);

export default router;
