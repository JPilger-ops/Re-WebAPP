import { Router } from "express";
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
} from "../controllers/user.controller.js";
import { authRequired, requireRole } from "../middleware/auth.middleware.js";

const router = Router();

// Nur Admin darf Benutzer verwalten
router.use(authRequired, requireRole("admin"));

router.get("/", getUsers);
router.post("/", createUser);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);

// Passwort zurücksetzen
router.post("/:id/reset-password", resetUserPassword);

export default router;