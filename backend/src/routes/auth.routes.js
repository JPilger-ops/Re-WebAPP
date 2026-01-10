import { Router } from "express";
import {
  login,
  register,
  logout,
  me,
  verifyCreatePin,
  getMfaStatus,
  startMfaSetup,
  verifyMfaSetup,
  disableMfa,
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

// MFA (TOTP)
router.get("/mfa/status", authRequired, getMfaStatus);
router.post("/mfa/setup", authRequired, startMfaSetup);
router.post("/mfa/verify", authRequired, verifyMfaSetup);
router.post("/mfa/disable", authRequired, disableMfa);

export default router;
