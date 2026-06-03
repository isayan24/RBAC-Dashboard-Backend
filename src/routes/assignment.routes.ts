import { Router } from "express";
import { Role } from "@prisma/client";
import {
  createAssignment,
  getAssignment,
  getAllAssignments,
  updateAssignment,
  deleteAssignment,
} from "../controllers/assignment.controller";
import {
  authenticateCheck,
  userRoleCheck,
} from "../middlewares/auth.middleware";

const router = Router();

// get assignment (specific) or all assignments
router.get("/", authenticateCheck, getAllAssignments);
router.get("/:id", authenticateCheck, getAssignment);

// admin protected routes
router.post(
  "/",
  authenticateCheck,
  userRoleCheck([Role.ADMIN]),
  createAssignment,
);
router.patch(
  "/:id",
  authenticateCheck,
  userRoleCheck([Role.ADMIN]),
  updateAssignment,
);
router.delete(
  "/:id",
  authenticateCheck,
  userRoleCheck([Role.ADMIN]),
  deleteAssignment,
);

export default router;
