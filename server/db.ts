import pg from "pg";

const { Pool } = pg;

const isRemote =
  process.env.DATABASE_URL &&
  (process.env.DATABASE_URL.includes("neon.tech") ||
    process.env.DATABASE_URL.includes("sslmode=require") ||
    (!process.env.DATABASE_URL.includes("localhost") &&
      !process.env.DATABASE_URL.includes("127.0.0.1") &&
      !process.env.DATABASE_URL.includes("@postgres:")));

export const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isRemote ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30_000,
    })
  : null;

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  values: unknown[] = []
) {
  if (!pool) return { rows: [] as T[], rowCount: 0 };
  return pool.query<T>(text, values);
}

export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  if (!pool) return fn(null as unknown as pg.PoolClient);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function healthcheck() {
  if (!pool) return { configured: false, healthy: false };
  try {
    await pool.query("SELECT 1");
    return { configured: true, healthy: true };
  } catch {
    return { configured: true, healthy: false };
  }
}
