import { z } from "zod";

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, { message: "Username must be at least 2 characters long" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  name: z
    .string()
    .min(2, { message: "Name must be at least 2 characters long" }),
  password: z
    .string()
    .min(4, { message: "Password must be at least 3 characters long" }),
  role: z.enum(["ADMIN", "STAFF"]).optional().default("STAFF"),
});

export const loginSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
});
