import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { ZodError } from "zod";
import prisma from "../utils/db";
import {
  loginSchema,
  registerSchema,
  updateUserSchema,
} from "../utils/auth.validation";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt";
import { handleError } from "../libs/handleError";
import { handleSuccess } from "../libs/handleSuccess";
import { TokenPayloadType } from "../types/tokenpayload.types";
import { refreshTokenSetToCookies } from "../libs/refreshTokenSetToCookies";

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

    // Create token
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

export const updateUser = async (req: Request, res: Response) => {
  try {
    const id = (req.query.id || req.body.id || req.params.id) as string;

    if (!id) {
      return handleError(res, 400, "User ID is required");
    }

    const validData = updateUserSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return handleError(res, 404, "User not found with this id");
    }

    const { username, email, name, password, role } = validData;

    if (email && email !== existingUser.email) {
      const existEmail = await prisma.user.findUnique({ where: { email } });
      if (existEmail) {
        return handleError(res, 400, "A user with this email already exists!");
      }
    }

    // Check if username already exists for another user
    if (username && username !== existingUser.username) {
      const sameUsername = await prisma.user.findUnique({
        where: { username },
      });
      if (sameUsername) {
        return handleError(res, 400, "This username is already taken");
      }
    }

    const updateData: any = {};
    if (username !== undefined) updateData.username = username;
    if (email !== undefined) updateData.email = email;
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;

    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    // Exclude password from response
    const { password: _, ...userWithoutPassword } = updatedUser;

    return handleSuccess(
      res,
      200,
      "User updated successfully",
      userWithoutPassword,
    );
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
    return handleError(res, 500, error.message || "Error updating user");
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

// generate a new Access Token & Refresh Token
export const refreshSession = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return handleError(res, 401, "Refresh token is missing");
    }

    // Verify token
    let decoded: TokenPayloadType;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (err) {
      return handleError(res, 401, "Invalid or expired refresh token");
    }

    // find the  token is still active in db?
    const activeToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!activeToken) {
      return handleError(res, 401, "Session has been expired.");
    }

    // Check database expiration
    if (activeToken.expiresAt < new Date()) {
      await prisma.refreshToken.delete({ where: { id: activeToken.id } });
      return handleError(res, 404, "Refresh token has expired.");
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });
    if (!user) {
      return handleError(res, 404, "User account not found.");
    }

    const tokenPayload: TokenPayloadType = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    // Generate fresh tokens
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

export const getMe = async (req: any, res: Response) => {
  try {
    // req.user gettng from the middleware!
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
