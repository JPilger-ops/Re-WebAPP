import { Router } from "express";
import {
  login,
  register,
  logout,
  me,
  verifyCreatePin,
} from "../controllers/auth.controller.js";
import { authRequired } from "../middleware/auth.middleware.js";
import { changePassword } from "../controllers/auth.controller.js";

const router = Router();

// Auth
router.post("/login", login);
router.post("/register", register); // geschützt über createPin im Body
router.post("/logout", logout);
router.get("/me", authRequired, me);

// optional alte PIN-Route, falls du sie noch brauchst
router.post("/verify-create-pin", verifyCreatePin);

// Passwort ändern
router.post("/change-password", authRequired, changePassword);

export default router;