import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, TokenPayloadType } from "../utils/jwt";
import { Role } from "@prisma/client";

export interface RequestWithUser extends Request {
  user?: TokenPayloadType;
}

// Middleware to authenticate requests using JWT Access Tokens in the Authorization header.
// Attaches the verified user payload to req.user.
export const authenticateCheck = (
  req: RequestWithUser,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Checking bearer token
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication failed: Bearer token is missing.",
      });
    }

    const token = authHeader.split(" ")[1];

    // Verify token payload
    const decoded = verifyAccessToken(token);

    // Attaching decoded token with req.user data
    req.user = decoded;

    return next();
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Access token been expired. Refresh your session",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Access token is incorrect",
    });
  }
};

// Middleware to restrict route access based on User Roles (RBAC).
// Expects the authenticate middleware to have already run and attached req.user.
export const userRoleCheck = (allowedRoles: Role[]) => {
  return (req: RequestWithUser, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Request is unauthenticated.",
      });
    }

    const hasRole = allowedRoles.includes(req.user.role);

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        message: `You do not have the required permissions ${allowedRoles}`,
      });
    }

    return next();
  };
};
