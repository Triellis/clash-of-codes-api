import { Router } from "express";

import { getConfig, postConfig } from "./config";
const router = Router();
router.get("/admin/config", getConfig);
router.post("/admin/config", postConfig);
export default router;
