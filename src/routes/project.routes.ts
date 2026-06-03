import { Router } from "express";
import { Role } from "@prisma/client";
import {
  createProjectController,
  getAllProjectsController,
  getProjectByIdController,
  updateProjectController,
  deleteProjectController,
} from "../controllers/project.controller";
import {
  authenticateCheck,
  userRoleCheck,
} from "../middlewares/auth.middleware";

const router = Router();

// public routes
router.get("/all", authenticateCheck, getAllProjectsController);
router.get("/:id", authenticateCheck, getProjectByIdController);

// Protected routes
router.post(
  "/",
  authenticateCheck,
  userRoleCheck([Role.ADMIN]),
  createProjectController,
);
router.patch(
  "/:id",
  authenticateCheck,
  userRoleCheck([Role.ADMIN]),
  updateProjectController,
);
router.delete(
  "/:id",
  authenticateCheck,
  userRoleCheck([Role.ADMIN]),
  deleteProjectController,
);

export default router;
