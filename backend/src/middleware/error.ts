import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { isProduction } from "../lib/env.js";
import { logError } from "../lib/logger.js";

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "Not found." });
}

function isDatabaseUnreachable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; message?: string; code?: string };
  const msg = e.message || "";
  return (
    e.name === "PrismaClientInitializationError" ||
    e.code === "P1001" ||
    /Can't reach database server/i.test(msg) ||
    /database.*does not exist/i.test(msg) ||
    /Unable to open the database file/i.test(msg)
  );
}

function httpStatusFromError(err: unknown): number | null {
  if (!err || typeof err !== "object") return null;
  const status = (err as { status?: unknown }).status;
  if (typeof status === "number" && status >= 400 && status < 600) return status;
  return null;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Validation failed.",
      ...(isProduction() ? {} : { details: err.flatten() }),
    });
  }

  const status = httpStatusFromError(err);
  if (status && err instanceof Error) {
    // Intentional client-facing errors (booking conflicts, etc.) — message is already safe.
    if (status >= 500) logError("http", err);
    return res.status(status).json({ error: err.message || "Request failed." });
  }

  // Prisma unique constraint (e.g. concurrent double-booking).
  if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") {
    return res.status(409).json({ error: "That slot is already booked." });
  }

  logError("http", err);
  if (isDatabaseUnreachable(err)) {
    return res.status(503).json({
      error: isProduction()
        ? "Service temporarily unavailable."
        : "Database unreachable. Ensure Postgres is running and migrations are applied (npm run db:deploy).",
    });
  }
  return res.status(500).json({ error: "Internal server error." });
}
