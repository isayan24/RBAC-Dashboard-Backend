import { Router } from "express";
import { getDashboardAnalytics } from "../controllers/analytics.controller";
import { authenticateCheck } from "../middlewares/auth.middleware";

const router = Router();

// Mount dashboard analytics endpoint
router.get("/", authenticateCheck, getDashboardAnalytics);

export default router;
