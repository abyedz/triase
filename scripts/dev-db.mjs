// Postgres lokal tanpa instalasi (PGlite) untuk pengembangan. Jalankan: npm run dev:db
// Lalu isi .env.local: DATABASE_URL=postgres://postgres:postgres@localhost:5433/postgres
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const db = await PGlite.create(process.env.PGLITE_DIR || "./.pglite");
const server = new PGLiteSocketServer({ db, port: 5433, host: "127.0.0.1" });
await server.start();
console.log("PGlite berjalan di postgres://postgres:postgres@localhost:5433/postgres");
process.on("SIGINT", async () => { await server.stop(); await db.close(); process.exit(0); });
