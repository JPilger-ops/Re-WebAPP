import { Router } from "express";
import { 
  createInvoice, 
  getAllInvoices, 
  getInvoiceById, 
  getInvoicePdf,
  markSent,
  getInvoiceEmailPreview,
  sendInvoiceEmail,
  getNextInvoiceNumber,
  markPaid,
  exportInvoiceToDatev,
  regenerateInvoicePdf,
  deleteInvoice,         // ⬅️ NEU
  getInvoiceStatusByReservation,
  updateInvoiceStatusByReservation
} from "../controllers/invoice.controller.js";
import { authRequired, requireRole, requireHkformsToken } from "../middleware/auth.middleware.js";

const router = Router();

// Integrations-Routen via ReservationRequest
router.get("/by-reservation/:reservationId/status", requireHkformsToken, getInvoiceStatusByReservation);
router.post("/by-reservation/:reservationId/status", requireHkformsToken, updateInvoiceStatusByReservation);

// Ab hier: reguläre App-API mit JWT
router.use(authRequired);

// Status-Routen
router.post("/:id/status/sent", markSent);
router.post("/:id/status/paid", markPaid);
router.get("/:id/email-preview", getInvoiceEmailPreview);
router.post("/:id/send-email", sendInvoiceEmail);
router.post("/:id/datev-export", exportInvoiceToDatev);

// Standard-Routen
router.get("/next-number", getNextInvoiceNumber);
router.get("/", getAllInvoices);     
router.get("/:id", getInvoiceById);
router.get("/:id/pdf", getInvoicePdf);
router.post("/:id/pdf/regenerate", requireRole("admin"), regenerateInvoicePdf);
router.post("/", createInvoice);

// Löschen
router.delete("/:id", requireRole("admin"), deleteInvoice);

export default router;
