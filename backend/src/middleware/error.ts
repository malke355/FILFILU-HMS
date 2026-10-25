import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

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

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Validation failed.", details: err.flatten() });
  }
  console.error(err);
  if (isDatabaseUnreachable(err)) {
    return res.status(503).json({
      error:
        "Database unreachable. Local default is SQLite (DATABASE_URL=file:./dev.db). If you use Postgres, run: docker compose up -d",
    });
  }
  return res.status(500).json({ error: "Internal server error." });
}
