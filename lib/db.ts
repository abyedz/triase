import { Pool } from "pg";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

export function pool(): Pool {
  if (!url) throw new Error("DATABASE_URL belum diset.");
  if (!globalThis.__pgPool) {
    const local = /localhost|127\.0\.0\.1/.test(url);
    globalThis.__pgPool = new Pool({
      connectionString: url,
      ssl: local ? false : { rejectUnauthorized: false },
      max: Number(process.env.DB_POOL_MAX) || 3, // serverless: jaga jumlah koneksi tetap kecil
      idleTimeoutMillis: 10_000,
    });
  }
  return globalThis.__pgPool;
}

export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool().query(text, params as never[]);
  return res.rows as T[];
}
