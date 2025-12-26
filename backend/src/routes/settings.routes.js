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
  testHkformsConnection,
  getTaxData,
  updateTaxData,
  getSmtpData,
  updateSmtpData,
  testSmtpSettings,
  getInvoiceHeaderData,
  updateInvoiceHeaderData,
  listApiKeys,
  createApiKey,
  rotateApiKey,
  revokeApiKey,
  deleteApiKey,
  getPdfSettingsData,
  updatePdfSettingsData,
  testPdfPath,
  getEmailTemplates,
  updateEmailTemplates,
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

router.post(
  "/hkforms/test",
  requirePermission("settings.general"),
  testHkformsConnection
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

router.get(
  "/smtp",
  requireRole("admin"),
  getSmtpData
);

router.put(
  "/smtp",
  requireRole("admin"),
  updateSmtpData
);

router.post(
  "/smtp/test",
  requireRole("admin"),
  testSmtpSettings
);

router.get(
  "/invoice-header",
  requireRole("admin"),
  getInvoiceHeaderData
);

router.put(
  "/invoice-header",
  requireRole("admin"),
  updateInvoiceHeaderData
);

router.get(
  "/pdf",
  requireRole("admin"),
  getPdfSettingsData
);

router.put(
  "/pdf",
  requireRole("admin"),
  updatePdfSettingsData
);

router.post(
  "/pdf/test-path",
  requireRole("admin"),
  testPdfPath
);

router.get(
  "/api-keys",
  requireRole("admin"),
  listApiKeys
);

router.post(
  "/api-keys",
  requireRole("admin"),
  createApiKey
);

router.post(
  "/api-keys/:id/rotate",
  requireRole("admin"),
  rotateApiKey
);

router.post(
  "/api-keys/:id/revoke",
  requireRole("admin"),
  revokeApiKey
);

router.delete(
  "/api-keys/:id",
  requireRole("admin"),
  deleteApiKey
);

router.get(
  "/email-templates",
  requireRole("admin"),
  getEmailTemplates
);

router.put(
  "/email-templates",
  requireRole("admin"),
  updateEmailTemplates
);

export default router;
