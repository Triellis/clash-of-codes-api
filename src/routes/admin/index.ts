import { Router } from "express";

import { getConfig } from "./config";
const router = Router();
router.get("/admin/config", getConfig);
export default router;
