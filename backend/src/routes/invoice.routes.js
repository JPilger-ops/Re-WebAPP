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

// Status-Routen
router.post("/:id/status/sent", requirePermission("invoices.update"), markSent);
router.post("/:id/status/paid", requirePermission("invoices.update"), markPaid);
router.post("/bulk-cancel", requirePermission("invoices.update"), bulkCancelInvoices);
router.get("/:id/email-preview", requirePermission("invoices.export"), getInvoiceEmailPreview);
router.post("/:id/send-email", requirePermission("invoices.export"), sendInvoiceEmail);
router.post("/:id/datev-export", requirePermission("invoices.export"), exportInvoiceToDatev);

// Standard-Routen
router.get("/next-number", requirePermission("invoices.create"), getNextInvoiceNumber);
router.get("/recent", requirePermission("invoices.read"), getRecentInvoices);
router.get("/", requirePermission("invoices.read"), getAllInvoices);     
router.get("/:id", requirePermission("invoices.read"), getInvoiceById);
router.get("/:id/pdf", requirePermission("invoices.read"), getInvoicePdf);
router.post("/:id/pdf/regenerate", requireRole("admin"), regenerateInvoicePdf);
router.put("/:id", requirePermission("invoices.update"), updateInvoice);
router.post("/", requirePermission("invoices.create"), createInvoice);

// Löschen
router.delete("/:id", requireRole("admin"), deleteInvoice);

export default router;
