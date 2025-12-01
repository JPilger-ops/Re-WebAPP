import { Router } from "express";
import { requirePermission } from "../middleware/auth.middleware.js";
import {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../controllers/category.controller.js";

const router = Router();

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