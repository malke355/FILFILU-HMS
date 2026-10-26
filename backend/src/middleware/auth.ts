import type { NextFunction, Request, Response } from "express";
import { verifyToken, type JwtPayload } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";
import { can } from "../lib/rbac.js";
import type { Role } from "../lib/roles.js";
import { SESSION_COOKIE } from "../lib/sessionCookie.js";

export type AuthedRequest = Request & { user?: JwtPayload };

function tokenFromRequest(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.[SESSION_COOKIE];
  return cookieToken || null;
}

export { tokenFromRequest };

async function loadValidSession(token: string): Promise<JwtPayload | null> {
  let payload: JwtPayload;
  try {
    payload = verifyToken(token);
  } catch {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      title: true,
      staffId: true,
      patientId: true,
      ward: true,
      dept: true,
      tokenVersion: true,
      staff: { select: { status: true } },
    },
  });

  if (!user) return null;
  if ((payload.tv ?? -1) !== user.tokenVersion) return null;
  if (user.staff && user.staff.status === "inactive") return null;

  return {
    sub: user.id,
    email: user.email,
    role: user.role as Role,
    name: user.name,
    tv: user.tokenVersion,
    staffId: user.staffId,
    patientId: user.patientId,
    ward: user.ward,
    dept: user.dept,
    title: user.title,
  };
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = tokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ error: "Authentication required." });
  }
  loadValidSession(token)
    .then((user) => {
      if (!user) {
        return res.status(401).json({ error: "Invalid or expired session. Please sign in again." });
      }
      req.user = user;
      return next();
    })
    .catch(next);
}

export function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const token = tokenFromRequest(req);
  if (!token) return next();
  loadValidSession(token)
    .then((user) => {
      if (user) req.user = user;
      next();
    })
    .catch(() => next());
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
