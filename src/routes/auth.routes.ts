import { Router } from "express";
import {
  register,
  login,
  logout,
  refreshSession,
  getMe,
  deleteUser,
  getAllUsers,
  updateUser,
} from "../controllers/auth.controller";
import { authenticateCheck } from "../middlewares/auth.middleware";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refreshSession);
router.post("/logout", logout);
router.delete("/users", deleteUser);
router.patch("/users", updateUser);
router.get("/users/all", getAllUsers);

// need the token to verify
router.get("/me", authenticateCheck, getMe);

export default router;
