// Menjalankan db/schema.sql ke database. Dilewati bila DATABASE_URL belum diisi.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.warn("[migrate] DATABASE_URL tidak diset, migrasi dilewati.");
  process.exit(0);
}
const sql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../db/schema.sql"), "utf8");
const local = /localhost|127\.0\.0\.1/.test(url);
const client = new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
try {
  await client.connect();
  await client.query(sql);
  console.log("[migrate] Skema database siap.");
} catch (e) {
  console.error("[migrate] Gagal:", e.message);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
