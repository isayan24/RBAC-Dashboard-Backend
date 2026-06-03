import { Router } from "express";
import {
  createTaskController,
  getTaskByIdController,
  getAllTasksController,
  updateTaskController,
  deleteTaskController,
} from "../controllers/task.controller";
import { authenticateCheck } from "../middlewares/auth.middleware";
import { upload } from "../middlewares/upload.middleware";

const router = Router();

router.post("/", authenticateCheck, upload.single("attachment"), createTaskController);
router.get("/", authenticateCheck, getAllTasksController);
router.get("/:id", authenticateCheck, getTaskByIdController);
router.patch("/:id", authenticateCheck, upload.single("attachment"), updateTaskController);
router.delete("/:id", authenticateCheck, deleteTaskController);

export default router;
