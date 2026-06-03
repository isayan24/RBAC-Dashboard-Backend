import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { Role } from "@prisma/client";
import { handleError } from "../libs/handleError";
import { handleSuccess } from "../libs/handleSuccess";
import { TokenPayloadType } from "../types/tokenpayload.types";

export interface RequestWithUser extends Request {
  user?: TokenPayloadType;
}

// Middleware to authenticate requests using JWT's header
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
      return handleError(
        res,
        401,
        "Authentication failed: Bearer token is missing.",
      );
    }

    const token = authHeader.split(" ")[1];

    // Verify token payload
    const decoded = verifyAccessToken(token);

    // Attaching decoded token with req.user data
    req.user = decoded;

    return next();
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      return handleError(
        res,
        401,
        "Access token been expired. Refresh your session",
      );
    }

    return handleError(res, 401, "Access token is incorrect");
  }
};

// Middleware to control routes
export const userRoleCheck = (allowedRoles: Role[]) => {
  return (req: RequestWithUser, res: Response, next: NextFunction) => {
    if (!req.user) {
      return handleError(res, 401, "Request is unauthenticated.");
    }

    const hasRole = allowedRoles.includes(req.user.role);

    if (!hasRole) {
      return handleError(
        res,
        403,
        `You do not have the required permissions: ${allowedRoles}`,
      );
    }

    return next();
  };
};
