import path from 'path';
import express, { type NextFunction, type Request, type Response } from 'express';

export function landingDirectory(): string {
  return path.resolve(__dirname, '../../../landing');
}

export function landingFiles() {
  const files = express.static(landingDirectory());
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.path === '/api' || req.path.startsWith('/api/')) {
      next();
      return;
    }
    files(req, res, next);
  };
}

export function allowedOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN || 'http://127.0.0.1:8080,http://localhost:8080';
  return raw.split(',').map((origin) => origin.trim()).filter(Boolean);
}
