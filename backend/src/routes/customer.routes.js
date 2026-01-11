import { Router } from "express";
import {
  getAllCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "../controllers/customer.controller.js";
import { requirePermission } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", requirePermission("customers.read"), getAllCustomers);
router.post("/", requirePermission("customers.create"), createCustomer);
router.put("/:id", requirePermission("customers.update"), updateCustomer);
router.delete("/:id", requirePermission("customers.delete"), deleteCustomer);

export default router;
