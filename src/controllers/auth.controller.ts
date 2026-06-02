import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import prisma from "../utils/db";
import { loginSchema, registerSchema } from "../utils/validation";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  TokenPayloadType,
} from "../utils/jwt";

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
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Validation data with zod
    const validatedData = registerSchema.parse(req.body);

    const { username, email, name, password, role } = validatedData;

    // Check if email already exists
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: "A user with this email already exists!",
      });
    }

    // Check if username already exists
    const existingUsername = await prisma.user.findUnique({
      where: { username },
    });
    if (existingUsername) {
      return res.status(400).json({
        success: false,
        message: "This username is already taken",
      });
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

    return res.status(201).json({
      success: true,
      message: "User registered successfully!",
      data: userWithoutPassword,
    });
  } catch (error) {
    // with next the global error handler with handle the error
    // without next i need to pass everytime a error block in return
    next(error);
  }
};

//  Login User
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const { email, password } = validatedData;

    // Find User
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
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

    return res.status(200).json({
      success: true,
      message: "Logged in successfully!",
      data: {
        accessToken,
        user: userWithoutPassword,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Logout User and invalidate session
export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
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

    return res.status(200).json({
      success: true,
      message: "Logged out successfully!",
    });
  } catch (error) {
    next(error);
  }
};

// delete user from db
export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.query.id as string;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "No id provided for deleting user!",
      });
    }
    const findUser = await prisma.user.findFirst({ where: { id } });

    if (!findUser) {
      return res.status(404).json({
        success: false,
        message: "No user with this id",
      });
    }

    await prisma.user.delete({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "User deleted from database",
    });
  } catch (error) {
    next(error);
  }
};

// Rotate session and generate a new Access Token & Refresh Token
export const refreshSession = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token is missing",
      });
    }

    // Verify token signature and expiration
    let decoded: TokenPayloadType;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token",
      });
    }

    // Query database whitelist to verify this token is still active
    const activeToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!activeToken) {
      return res.status(401).json({
        success: false,
        message: "Session has been invalidated or expired.",
      });
    }

    // Check database record expiration explicitly
    if (activeToken.expiresAt < new Date()) {
      await prisma.refreshToken.delete({ where: { id: activeToken.id } });
      return res.status(404).json({
        success: false,
        message: "Refresh token has expired.",
      });
    }

    // Fetch user to confirm account still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found.",
      });
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

    // Delete the old refresh token from DB
    await prisma.refreshToken.delete({ where: { id: activeToken.id } });

    // Store the new refresh token in DB
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

    return res.status(200).json({
      success: true,
      message: "Session rotated successfully!",
      data: {
        accessToken: newAccessToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Fetch authenticated User profile details
export const getMe = async (req: any, res: Response, next: NextFunction) => {
  try {
    // req.user is attached by the authenticate middleware
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User is not authenticated.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User profile not found.",
      });
    }

    // remove password from response
    const { password: _, ...rawUserWithNoPassword } = user;

    return res.status(200).json({
      success: true,
      data: rawUserWithNoPassword,
    });
  } catch (error) {
    next(error);
  }
};
