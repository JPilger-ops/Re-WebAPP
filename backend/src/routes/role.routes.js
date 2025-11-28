import { Router } from "express";
import {
  getRoles,
  getRolePermissions,
  createRole,
  updateRole,
  deleteRole
} from "../controllers/role.controller.js";
import { authRequired, requireRole } from "../middleware/auth.middleware.js";

const router = Router();

router.use(authRequired, requireRole("admin"));

router.get("/", getRoles);
router.get("/:id/permissions", getRolePermissions);
router.post("/", createRole);
router.put("/:id", updateRole);
router.delete("/:id", deleteRole);

export default router;