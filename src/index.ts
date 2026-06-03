import express, { Request, Response, NextFunction, Errback } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import authRouter from "./routes/auth.routes";
import projectRouter from "./routes/project.routes";
import assignmentRouter from "./routes/assignment.routes";
import { ZodError } from "zod";
import { register } from "./controllers/auth.controller";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// middlewares
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Mount API routers
app.use("/api/auth", authRouter);
app.use("/api/project", projectRouter);
app.use("/api/assignment", assignmentRouter);

// Home Route
app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    message: "Welcome to the RBAC Dashboard API!",
    status: "healthy",
    timestamp: new Date(),
  });
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
