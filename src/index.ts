import express, { Request, Response, NextFunction, Errback } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import authRouter from "./routes/auth.routes";
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

// Home Route
app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    message: "Welcome to the RBAC Dashboard API!",
    status: "healthy",
    timestamp: new Date(),
  });
});

// main error handling middleware
app.use((err: any, req: Request, res: Response) => {
  console.error("Unhandle Error Logged: ", err);

  // Handle Zod errros
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        status: 400,
        message: "Validation Error",
        details: err.errors.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
    });
  }

  const status = err.status || 500;
  const message = err.message || "Internal Server Error";

  res.status(status).json({
    success: false,
    error: {
      status,
      message,
    },
  });
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
