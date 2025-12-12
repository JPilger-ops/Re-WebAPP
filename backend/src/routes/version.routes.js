import { Router } from "express";
import { getVersion } from "../controllers/version.controller.js";

const router = Router();

router.get("/", getVersion);

export default router;
