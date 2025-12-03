import { Router } from "express";
import {
  authRequired,
  requirePermission,
} from "../middleware/auth.middleware.js";
import {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  uploadLogo,
  listLogos,
} from "../controllers/category.controller.js";

const router = Router();

// Erst Token prüfen, damit requirePermission auf req.user zugreifen kann
router.use(authRequired);

router.get(
  "/",
  requirePermission("categories.read"),
  getAllCategories
);

router.post(
  "/",
  requirePermission("categories.write"),
  createCategory
);

router.post(
  "/logo",
  requirePermission("categories.write"),
  uploadLogo
);

router.get(
  "/logos",
  requirePermission("categories.read"),
  listLogos
);

router.put(
  "/:id",
  requirePermission("categories.write"),
  updateCategory
);

router.delete(
  "/:id",
  requirePermission("categories.delete"),
  deleteCategory
);

export default router;
