import { Router } from "express";
import { authRequired, requireRole } from "../middleware/auth.middleware.js";
import {
  createBackupHandler,
  deleteBackupHandler,
  downloadBackupHandler,
  getBackupSettings,
  invoicesArchiveHandler,
  listBackupsHandler,
  restoreBackupHandler,
  testBackupPathHandler,
  updateBackupSettings,
  mountNfsHandler,
} from "../controllers/backup.controller.js";

const router = Router();

router.use(authRequired, requireRole("admin"));

router.get("/settings", getBackupSettings);
router.put("/settings", updateBackupSettings);
router.post("/test-path", testBackupPathHandler);
router.post("/nfs/mount", mountNfsHandler);
router.get("/invoices/archive", invoicesArchiveHandler);
router.get("/", listBackupsHandler);
router.post("/", createBackupHandler);
router.post("/restore", restoreBackupHandler);
router.get("/:name/download", downloadBackupHandler);
router.delete("/:name", deleteBackupHandler);

export default router;
