import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import authRoutes from "./routes/auth.js";
import contactRoutes from "./routes/contact.js";
import publicRoutes from "./routes/public.js";
import resourceRoutes from "./routes/resources.js";
import { errorHandler, notFound } from "./middleware/error.js";

const landingDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../landing");

function parseOrigins() {
  const raw = process.env.CORS_ORIGIN || "http://127.0.0.1:8080,http://localhost:8080";
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export function createApp() {
  const app = express();

  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }));
  app.use(
    cors({
      origin: parseOrigins(),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

  app.get("/api", (_req, res) => {
    res.json({
      name: "Filfilu HMS API",
      version: "1.0.0",
      ui: "/login.html",
      health: "/api/health",
    });
  });

  app.use("/api", publicRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api", contactRoutes);
  app.use("/api", resourceRoutes);

  app.use(express.static(landingDir));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
