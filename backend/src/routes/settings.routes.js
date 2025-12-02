import { Router } from "express";
import { authRequired, requirePermission } from "../middleware/auth.middleware.js";
import { getBankData, updateBankData } from "../controllers/settings.controller.js";

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

export default router;
