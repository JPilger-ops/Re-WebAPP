import { Router } from "express";
import {
  authRequired,
} from "../middleware/auth.middleware.js";
import {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  uploadLogo,
  listLogos,
  getCategoryEmail,
  saveCategoryEmail,
  testCategoryEmail,
  getCategoryTemplate,
  saveCategoryTemplate,
} from "../controllers/category.controller.js";

const router = Router();

// erlaubt Zugriff, wenn mindestens eine der angegebenen Permissions vorhanden ist
const requireAnyPermission = (...perms) => (req, res, next) => {
  const userPerms = req.user?.permissions || [];
  if (perms.some((perm) => userPerms.includes(perm))) {
    return next();
  }
  return res.status(403).json({ message: "Keine Berechtigung." });
};

// Erst Token prüfen, damit requirePermission auf req.user zugreifen kann
router.use(authRequired);

router.get(
  "/",
  requireAnyPermission("categories.read", "settings.general"),
  getAllCategories
);

router.post(
  "/",
  requireAnyPermission("categories.write", "settings.general"),
  createCategory
);

router.post(
  "/logo",
  requireAnyPermission("categories.write", "settings.general"),
  uploadLogo
);

router.get(
  "/logos",
  requireAnyPermission("categories.read", "settings.general"),
  listLogos
);

router.put(
  "/:id",
  requireAnyPermission("categories.write", "settings.general"),
  updateCategory
);

router.delete(
  "/:id",
  requireAnyPermission("categories.delete", "settings.general"),
  deleteCategory
);

// E-Mail Konto je Kategorie
router.get(
  "/:id/email",
  requireAnyPermission("categories.read", "settings.general"),
  getCategoryEmail
);

router.post(
  "/:id/email",
  requireAnyPermission("categories.write", "settings.general"),
  saveCategoryEmail
);

router.post(
  "/:id/email/test",
  requireAnyPermission("categories.write", "settings.general"),
  testCategoryEmail
);

// Template je Kategorie
router.get(
  "/:id/template",
  requireAnyPermission("categories.read", "settings.general"),
  getCategoryTemplate
);

router.post(
  "/:id/template",
  requireAnyPermission("categories.write", "settings.general"),
  saveCategoryTemplate
);

export default router;
