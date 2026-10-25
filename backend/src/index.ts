import "dotenv/config";
import { createApp } from "./app.js";
import { ensureSchema } from "./db/ensureSchema.js";
import { pool } from "./db/pool.js";

const port = Number(process.env.PORT || 8080);

async function main() {
  try {
    await pool.query("SELECT 1");
    await ensureSchema();
    console.log(
      `PostgreSQL connected: ${process.env.PGHOST || "localhost"}:${process.env.PGPORT || "5433"}/${process.env.PGDATABASE || "hms"}`,
    );
  } catch (err) {
    console.error("Failed to connect/initialize PostgreSQL. Check .env and that Postgres is running.", err);
    process.exit(1);
  }

  const app = createApp();
  app.listen(port, "0.0.0.0", () => {
    console.log(`Filfilu app http://127.0.0.1:${port}/login.html`);
    console.log(`Filfilu API http://127.0.0.1:${port}/api/health`);
  });
}

main();
