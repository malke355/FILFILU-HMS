import pg from "pg";

const { Pool } = pg;

/**
 * Connection comes only from .env (PG* vars or DATABASE_URL).
 * Never hardcode host/user/password in source.
 */
export const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST || "localhost",
        port: Number(process.env.PGPORT || 5433),
        database: process.env.PGDATABASE || "hms",
        user: process.env.PGUSER || "postgres",
        password: process.env.PGPASSWORD,
      },
);

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
) {
  return pool.query<T>(text, params);
}
