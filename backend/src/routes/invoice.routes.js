import { Router } from "express";
import { 
  createInvoice, 
  getAllInvoices, 
  getInvoiceById, 
  getInvoicePdf,
  getRecentInvoices,
  markSent,
  getInvoiceEmailPreview,
  sendInvoiceEmail,
  getNextInvoiceNumber,
  updateInvoice,
  markPaid,
  exportInvoiceToDatev,
  regenerateInvoicePdf,
  listInvoiceItemLibrary,
  deleteInvoice,         // ⬅️ NEU
  bulkCancelInvoices,
  getInvoiceStatusByReservation,
  updateInvoiceStatusByReservation
} from "../controllers/invoice.controller.js";
import { authRequired, requireRole, requireHkformsToken, requirePermission } from "../middleware/auth.middleware.js";

const router = Router();

// Integrations-Routen via ReservationRequest
router.get("/by-reservation/:reservationId/status", requireHkformsToken, getInvoiceStatusByReservation);
router.post("/by-reservation/:reservationId/status", requireHkformsToken, updateInvoiceStatusByReservation);

// Ab hier: reguläre App-API mit JWT
router.use(authRequired);

// erlaubt Zugriff, wenn mindestens eine der angegebenen Permissions vorhanden ist
const requireAnyPermission = (...perms) => (req, res, next) => {
  const userPerms = req.user?.permissions || [];
  if (perms.some((perm) => userPerms.includes(perm))) {
    return next();
  }
  return res.status(403).json({ message: "Keine Berechtigung." });
};

// Status-Routen
router.post("/:id/status/sent", requirePermission("invoices.update"), markSent);
router.post("/:id/status/paid", requirePermission("invoices.update"), markPaid);
router.post("/bulk-cancel", requirePermission("invoices.update"), bulkCancelInvoices);
router.get("/:id/email-preview", requirePermission("invoices.export"), getInvoiceEmailPreview);
router.post("/:id/send-email", requirePermission("invoices.export"), sendInvoiceEmail);
router.post("/:id/datev-export", requirePermission("invoices.export"), exportInvoiceToDatev);

// Standard-Routen
router.get("/next-number", requirePermission("invoices.create"), getNextInvoiceNumber);
router.get("/items/library", requireAnyPermission("invoices.create", "invoices.update"), listInvoiceItemLibrary);
router.get("/recent", requirePermission("invoices.read"), getRecentInvoices);
router.get("/", requirePermission("invoices.read"), getAllInvoices);     
router.get("/:id", requirePermission("invoices.read"), getInvoiceById);
router.get("/:id/pdf", requireAnyPermission("invoices.read", "invoices.create"), getInvoicePdf);
router.post("/:id/pdf/regenerate", requirePermission("invoices.regenerate"), regenerateInvoicePdf);
router.put("/:id", requirePermission("invoices.update"), updateInvoice);
router.post("/", requirePermission("invoices.create"), createInvoice);

// Löschen
router.delete("/:id", requireRole("admin"), deleteInvoice);

export default router;
