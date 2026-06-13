import type { NextFunction, Request, Response } from "express";
import { AppError } from "./error.js";
import { verifyAuthToken } from "../utils/tokens.js";
import type { AuthRole, AuthUser } from "../types/auth.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    throw new AppError(401, "Missing bearer token", "MISSING_AUTH_TOKEN");
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    req.user = verifyAuthToken(token);
    next();
  } catch {
    throw new AppError(401, "Invalid or expired token", "INVALID_AUTH_TOKEN");
  }
}

export function requireRole(...allowedRoles: AuthRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError(401, "Authentication required", "AUTH_REQUIRED");
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError(403, "You do not have permission for this action", "FORBIDDEN");
    }

    next();
  };
}