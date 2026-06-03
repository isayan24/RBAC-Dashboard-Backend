import { Router } from "express";
import {
  createTaskController,
  getTaskByIdController,
  getAllTasksController,
  updateTaskController,
  deleteTaskController,
} from "../controllers/task.controller";
import { authenticateCheck } from "../middlewares/auth.middleware";

const router = Router();

router.post("/", authenticateCheck, createTaskController);
router.get("/", authenticateCheck, getAllTasksController);
router.get("/:id", authenticateCheck, getTaskByIdController);
router.patch("/:id", authenticateCheck, updateTaskController);
router.delete("/:id", authenticateCheck, deleteTaskController);

export default router;
