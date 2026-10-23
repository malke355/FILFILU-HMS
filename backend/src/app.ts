import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import authRoutes from "./routes/auth.js";
import contactRoutes from "./routes/contact.js";
import publicRoutes from "./routes/public.js";
import resourceRoutes from "./routes/resources.js";
import { errorHandler, notFound } from "./middleware/error.js";

function parseOrigins() {
  const raw = process.env.CORS_ORIGIN || "http://127.0.0.1:8080,http://localhost:8080";
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export function createApp() {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: parseOrigins(),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

  app.get("/", (_req, res) => {
    res.json({
      name: "Filfilu HMS API",
      version: "1.0.0",
      docs: {
        health: "GET /api/health",
        auth: "POST /api/auth/login | /api/auth/signup | GET /api/auth/me",
        resources: "GET /api/staff | /patients | /appointments | /shifts | /exchanges | /notifications | /dashboard/stats",
        public: "GET /api/doctors | /doctor-schedules | /departments | /specialties",
        forms: "POST /api/contact | /api/bookings",
      },
    });
  });

  app.use("/api", publicRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api", contactRoutes);
  app.use("/api", resourceRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
