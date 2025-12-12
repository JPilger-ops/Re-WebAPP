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
  deleteInvoice         // ⬅️ NEU
} from "../controllers/invoice.controller.js";
import { requireRole } from "../middleware/auth.middleware.js";

const router = Router();

// Status-Routen
router.post("/:id/status/sent", markSent);
router.post("/:id/status/paid", markPaid);
router.get("/:id/email-preview", getInvoiceEmailPreview);
router.post("/:id/send-email", sendInvoiceEmail);

// Standard-Routen
router.get("/next-number", getNextInvoiceNumber);
router.get("/", getAllInvoices);     
router.get("/:id", getInvoiceById);
router.get("/:id/pdf", getInvoicePdf);
router.post("/", createInvoice);

// Löschen
router.delete("/:id", requireRole("admin"), deleteInvoice);

export default router;
