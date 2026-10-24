import type { NextFunction, Request, Response } from "express";
import { verifyToken, type JwtPayload } from "../lib/auth.js";
import { SESSION_COOKIE } from "../lib/sessionCookie.js";
import { can } from "../lib/rbac.js";
import type { Role } from "../lib/roles.js";

export type AuthedRequest = Request & { user?: JwtPayload };

function tokenFromRequest(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.[SESSION_COOKIE];
  return cookieToken || null;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = tokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ error: "Authentication required." });
  }
  try {
    req.user = verifyToken(token);
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

export function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const token = tokenFromRequest(req);
  if (token) {
    try {
      req.user = verifyToken(token);
    } catch {
      /* ignore */
    }
  }
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Authentication required." });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden for this role." });
    }
    return next();
  };
}

export function requirePermission(...permissions: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Authentication required." });
    if (!permissions.some((p) => can(req.user!.role, p))) {
      return res.status(403).json({ error: "Missing permission." });
    }
    return next();
  };
}
