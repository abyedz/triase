// Menjalankan db/schema.sql ke database (idempoten). Dipanggil saat build.
// - Mencoba beberapa URL berurutan; pooler Supabase (IPv4) didahulukan karena mesin build Vercel tidak punya IPv6
//   sedangkan host langsung db.<ref>.supabase.co hanya IPv6.
// - Bila semua gagal: build TIDAK digagalkan (tabel mungkin sudah ada), kecuali MIGRATE_STRICT=1.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dns from "node:dns";
import pg from "pg";

dns.setDefaultResultOrder("ipv4first");

const e = process.env;
const candidates = [...new Set([
  e.TRYASE_POSTGRES_URL, e.DATABASE_URL, e.POSTGRES_URL,
  e.TRYASE_POSTGRES_URL_NON_POOLING, e.DATABASE_URL_UNPOOLED, e.POSTGRES_URL_NON_POOLING,
].filter(Boolean))];

if (!candidates.length) {
  console.warn("[migrate] URL database tidak diset (DATABASE_URL / POSTGRES_URL / TRYASE_POSTGRES_URL), migrasi dilewati.");
  process.exit(0);
}

const sql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../db/schema.sql"), "utf8");

async function tryRun(raw) {
  const u = new URL(raw);
  const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(u.hostname);
  u.search = ""; // buang sslmode/pgbouncer/supa; SSL diatur eksplisit
  const client = new pg.Client({
    connectionString: u.toString(),
    ssl: local ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  try {
    await client.connect();
    await client.query(sql);
    return { host: u.hostname + ":" + (u.port || 5432) };
  } finally {
    await client.end().catch(() => {});
  }
}

const errors = [];
for (const raw of candidates) {
  try {
    const r = await tryRun(raw);
    console.log("[migrate] Skema database siap via " + r.host);
    process.exit(0);
  } catch (err) {
    errors.push(`${new URL(raw).hostname}: ${err.message}`);
  }
}
console.error("[migrate] Semua koneksi gagal:\n - " + errors.join("\n - "));
if (e.MIGRATE_STRICT === "1") process.exit(1);
console.warn("[migrate] Dilanjutkan tanpa migrasi. Pastikan tabel sudah ada (jalankan db/schema.sql di SQL Editor Supabase).");
