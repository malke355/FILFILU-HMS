import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { isProduction, parseCorsOrigins } from "./lib/env.js";
import authRoutes from "./routes/auth.js";
import contactRoutes from "./routes/contact.js";
import publicRoutes from "./routes/public.js";
import resourceRoutes from "./routes/resources.js";
import { errorHandler, notFound } from "./middleware/error.js";

const landingDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../landing");

export function createApp() {
  const app = express();
  const origins = parseCorsOrigins();
  const prod = isProduction();

  // Needed so rate limits see the real client IP behind a reverse proxy (nginx, etc.).
  if (process.env.TRUST_PROXY === "1" || prod) {
    app.set("trust proxy", 1);
  }

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        // Landing pages still use inline <script>/<style>; keep self + inline, block foreign script hosts except Google.
        "script-src": ["'self'", "'unsafe-inline'", "https://www.gstatic.com", "https://accounts.google.com"],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
        "img-src": ["'self'", "data:", "https:"],
        "connect-src": ["'self'", "https://www.googleapis.com", "https://securetoken.googleapis.com", "https://identitytoolkit.googleapis.com", ...origins],
        "frame-src": ["'self'", "https://accounts.google.com"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        "frame-ancestors": ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" },
    referrerPolicy: { policy: "no-referrer" },
  }));
  app.use(
    cors({
      origin: origins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  // Access logs without query strings (tokens) or request bodies.
  morgan.token("safe-url", (req) => {
    const pathOnly = (req.url || "").split("?")[0] || "/";
    return pathOnly;
  });
  app.use(
    morgan(
      prod
        ? ':remote-addr :method :safe-url :status :res[content-length] - :response-time ms'
        : ':method :safe-url :status :response-time ms',
    ),
  );

  app.get("/api", (_req, res) => {
    // Production: minimal index (no route map). Dev: helpful discovery.
    if (prod) {
      return res.json({ name: "Filfilu HMS API", version: "1.0.0", health: "/api/health" });
    }
    res.json({
      name: "Filfilu HMS API",
      version: "1.0.0",
      ui: "/login.html",
      health: "/api/health",
      docs: {
        health: "GET /api/health",
        auth: "POST /api/auth/login | /api/auth/signup | /api/auth/forgot-password | /api/auth/reset-password | GET /api/auth/google | GET /api/auth/google/callback | POST /api/auth/logout | GET /api/auth/me",
        resources: "GET /api/staff | /patients | /appointments | /shifts | /exchanges | /notifications | /dashboard/stats | /activity",
        mutations: "POST /api/appointments | /exchanges | /exchanges/approve-pending | /shifts/publish-drafts",
        public: "GET /api/doctors | /doctor-schedules | /departments | /specialties",
        forms: "POST /api/contact | /api/bookings",
      },
    });
  });

  app.use("/api", publicRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api", contactRoutes);
  app.use("/api", resourceRoutes);

  // Clean URLs → landing HTML (e.g. /signup → signup.html)
  for (const page of ["login", "signup", "app", "forgot-password", "reset-password"] as const) {
    app.get(`/${page}`, (_req, res) => {
      res.sendFile(path.join(landingDir, `${page}.html`));
    });
  }

  app.use(express.static(landingDir));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
