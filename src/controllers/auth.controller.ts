import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { ZodError } from "zod";
import prisma from "../utils/db";
import { loginSchema, registerSchema } from "../utils/auth.validation";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  TokenPayloadType,
} from "../utils/jwt";
import { handleError } from "../libs/handleError";
import { handleSuccess } from "../libs/handleSuccess";

// set refresh token into cookie
const refreshTokenSetToCookies = (res: any, token: string) => {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

// Register a new User
export const register = async (req: Request, res: Response) => {
  try {
    // Validation data with zod
    const validData = registerSchema.parse(req.body);

    const { username, email, name, password, role } = validData;

    // Check if email already exists
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      return handleError(res, 400, "A user with this email already exists!");
    }

    // Check if username already exists
    const existingUsername = await prisma.user.findUnique({
      where: { username },
    });
    if (existingUsername) {
      return handleError(res, 400, "This username is already taken");
    }

    // Hashing the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // User creation
    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        name,
        password: hashedPassword,
        role,
      },
    });

    // Exclude password from response
    const { password: _, ...userWithoutPassword } = newUser;

    return handleSuccess(
      res,
      201,
      "User registered successfully!",
      userWithoutPassword,
    );
  } catch (error: any) {
    if (error instanceof ZodError) {
      return handleError(res, 400, "All fields are required", error);
    }
    return handleError(res, 500, error.message || "Internal Server Error");
  }
};

//  Login User
export const login = async (req: Request, res: Response) => {
  try {
    const validData = loginSchema.parse(req.body);
    const { email, password } = validData;

    // Find User
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return handleError(res, 404, "No account found with this email");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return handleError(res, 401, "Invalid email or password");
    }

    // Create token payloads
    const tokenPayload: TokenPayloadType = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    // Generate tokens
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    // Set refresh token in HttpOnly secure cookie
    refreshTokenSetToCookies(res, refreshToken);

    // Not include password in the response
    const { password: _, ...userWithoutPassword } = user;

    return handleSuccess(res, 200, "Logged in successfully!", {
      accessToken,
      user: userWithoutPassword,
    });
  } catch (error: any) {
    if (error instanceof ZodError) {
      return handleError(
        res,
        400,
        "Validation Error",
        error.errors.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      );
    }
    return handleError(res, 500, error.message || "Internal Server Error");
  }
};

// Logout User and invalidate session
export const logout = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.cookies;

    // delete refresh token when user logout
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      });
    }

    // Clear cookie
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    return handleSuccess(res, 200, "Logged out successfully!");
  } catch (error: any) {
    return handleError(res, 500, error.message || "Internal Server Error");
  }
};

// delete user from db
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const id = req.query.id as string;

    if (!id) {
      return handleError(res, 400, "No id provided for deleting user!");
    }
    const findUser = await prisma.user.findFirst({ where: { id } });

    if (!findUser) {
      return handleError(res, 404, "There is no user with this id");
    }

    await prisma.user.delete({ where: { id } });

    return handleSuccess(res, 200, "User deleted from database");
  } catch (error: any) {
    return handleError(res, 500, error.message || "Internal Server Error");
  }
};

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany();

    return handleSuccess(res, 200, "Fetched all users", users);
  } catch (error: any) {
    return handleError(res, 500, error.message || "Failed to fetch users");
  }
};

// Rotate session and generate a new Access Token & Refresh Token
export const refreshSession = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return handleError(res, 401, "Refresh token is missing");
    }

    // Verify token signature and expiration
    let decoded: TokenPayloadType;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (err) {
      return handleError(res, 401, "Invalid or expired refresh token");
    }

    // Query database whitelist to verify this token is still active
    const activeToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!activeToken) {
      return handleError(res, 401, "Session has been invalidated or expired.");
    }

    // Check database record expiration explicitly
    if (activeToken.expiresAt < new Date()) {
      await prisma.refreshToken.delete({ where: { id: activeToken.id } });
      return handleError(res, 404, "Refresh token has expired.");
    }

    // getting user to confirm account exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });
    if (!user) {
      return handleError(res, 404, "User account not found.");
    }

    // Token rotation payload
    const tokenPayload: TokenPayloadType = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    // Generate fresh token pair
    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    // delete the old refresh token from DB
    await prisma.refreshToken.delete({ where: { id: activeToken.id } });

    // store the new refresh token in DB
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    // Update refresh token cookie in response
    refreshTokenSetToCookies(res, newRefreshToken);

    return handleSuccess(res, 200, "Session rotated successfully!", {
      accessToken: newAccessToken,
    });
  } catch (error: any) {
    return handleError(res, 500, error.message || "Internal Server Error");
  }
};

// Fetch authenticated User profile details
export const getMe = async (req: any, res: Response) => {
  try {
    // req.user is attached by the authenticate middleware
    if (!req.user) {
      return handleError(res, 401, "User is not authenticated.");
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (!user) {
      return handleError(res, 404, "User profile not found.");
    }

    // remove password from response
    const { password: _, ...rawUserWithNoPassword } = user;

    return handleSuccess(
      res,
      200,
      "User profile fetched successfully!",
      rawUserWithNoPassword,
    );
  } catch (error: any) {
    return handleError(res, 500, error.message || "Internal Server Error");
  }
};
