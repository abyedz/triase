import { Pool } from "pg";

// Mendukung Neon/Vercel (DATABASE_URL, POSTGRES_URL) dan Supabase (mis. TRYASE_POSTGRES_URL = pooler port 6543).
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.TRYASE_POSTGRES_URL;

/** Buang query string (sslmode, pgbouncer, supa, ...) agar SSL diatur eksplisit di bawah. */
function connConfig(raw: string) {
  const u = new URL(raw);
  const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(u.hostname);
  u.search = "";
  return { connectionString: u.toString(), ssl: local ? (false as const) : { rejectUnauthorized: false } };
}

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

export function pool(): Pool {
  if (!url) throw new Error("DATABASE_URL belum diset.");
  if (!globalThis.__pgPool) {
    globalThis.__pgPool = new Pool({
      ...connConfig(url),
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
