import "dotenv/config";
import { createApp } from "./app.js";
import { listenWithNest } from "./nest-host.js";
import { applyDataRetention } from "./lib/audit.js";
import { assertEnvConfigured, isProduction } from "./lib/env.js";
import { assertGoogleProductionConfig } from "./lib/google.js";
import { assertSmtpProductionConfig, smtpConfigured } from "./lib/mail.js";
import { logError, logInfo } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { cookieSecure } from "./lib/sessionCookie.js";

const port = Number(process.env.PORT || 8080);

async function main() {
  try {
    assertEnvConfigured();
    assertGoogleProductionConfig();
    assertSmtpProductionConfig();
    if (isProduction() && !cookieSecure()) {
      throw new Error(
        "Secure cookies are required in production. Set NODE_ENV=production (and COOKIE_SECURE=1 if needed) behind HTTPS.",
      );
    }
  } catch (err) {
    logError("startup.config", err);
    process.exit(1);
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    await applyDataRetention();
    if (!isProduction()) {
      logInfo(
        `PostgreSQL connected: ${process.env.PGHOST || "localhost"}:${process.env.PGPORT || "5434"}/${process.env.PGDATABASE || "hms"}`,
      );
    } else {
      logInfo("PostgreSQL connected.");
    }
  } catch (err) {
    logError("startup.database", err);
    console.error("Failed to connect to PostgreSQL. Check .env and run: npm run db:deploy");
    process.exit(1);
  }

  const app = createApp();
  await listenWithNest(app, port);
  logInfo(`Filfilu app http://127.0.0.1:${port}/login.html`);
  logInfo(`Filfilu API http://127.0.0.1:${port}/api/health`);
  logInfo(smtpConfigured() ? "SMTP mail: configured" : "SMTP mail: not configured (dev reset links only)");
}

main();
