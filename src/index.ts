import express, { Request, Response, NextFunction, Errback } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

dotenv.config();

import authRouter from "./routes/auth.routes";
import projectRouter from "./routes/project.routes";
import assignmentRouter from "./routes/assignment.routes";
import taskRouter from "./routes/task.routes";

import { ZodError } from "zod";
import { register } from "./controllers/auth.controller";

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3000/",
  "http://localhost:3001/",
];

// middlewares
app.use(helmet());
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// API routers
app.use("/api/auth", authRouter);
app.use("/api/project", projectRouter);
app.use("/api/assignment", assignmentRouter);
app.use("/api/task", taskRouter);

// Home Route
app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    message: "Api is Healthy and running!",
    status: true,
    timestamp: new Date(),
  });
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
