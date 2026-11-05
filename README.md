# TriaSiap (Next.js + Postgres)

Triase START, pencatatan korban, dan dashboard evakuasi. Dikonversi dari file HTML tunggal menjadi aplikasi Next.js (App Router) dengan database Postgres, sehingga data **tersinkron antar-HP** dan tidak lagi hanya di `localStorage`.

## Yang berubah dari versi HTML

| Sebelumnya | Sekarang |
|---|---|
| Data di `localStorage` per perangkat | Postgres (tabel `victims`, `reports`, `usability_tests`, `settings`, ...) |
| Hash sandi koordinator di JavaScript klien | Diperiksa di server; sesi lewat cookie `HttpOnly` bertanda tangan (JWT) |
| Batas 3 percobaan di browser | Batas 3 percobaan per IP di server (kunci 15 menit) |
| Kode email butuh backend (belum ada) | Siap pakai via Resend (opsional) |
| Ekspor/impor JSON manual antar-HP | Tetap ada (arsip/migrasi), tapi sinkron otomatis tiap 10 detik |
| Laporan/offline = simulasi | Antrean offline sungguhan (tersimpan di perangkat, terkirim otomatis saat online) |

Hak akses: Perawat/Relawan boleh triase, retriase, dan lapor. **Koordinator** saja yang boleh memperbarui evakuasi, impor, menghapus data, dan melihat dashboard komandan (ditegakkan di server).

## Deploy ke Vercel

1. Push folder ini ke GitHub, lalu **Add New > Project** di Vercel dan pilih repo-nya (framework terdeteksi otomatis: Next.js).
2. Buat database: di project Vercel buka **Storage > Create Database > Neon (Postgres)** dan hubungkan ke project. Ini otomatis mengisi `DATABASE_URL`.
3. Isi **Environment Variables** (lihat `.env.example`):
   - `AUTH_SECRET` — acak, `openssl rand -base64 32`
   - `COORDINATOR_PASSWORD_HASH` — `printf 'SandiBaru' | shasum -a 256`
   - `COORDINATOR_EMAILS` — email koordinator (pisahkan dengan koma)
   - `RESEND_API_KEY` dan `EMAIL_FROM` — opsional, untuk login/pemulihan lewat kode email
4. **Deploy.** Tabel dibuat otomatis saat build (`npm run build` menjalankan `scripts/migrate.mjs`, idempoten).

> Hash sandi lama dari file HTML dipakai sebagai nilai contoh di `.env.example`. SHA-256 tanpa salt mudah ditebak bila hash bocor; sebaiknya buat sandi baru, atau atur ulang lewat "Lupa sandi?" (disimpan dengan scrypt + salt di database).

## Pengembangan lokal

```bash
npm install
cp .env.example .env.local     # isi AUTH_SECRET dan sandi
npm run dev:db                 # Postgres lokal (PGlite) di port 5433, biarkan berjalan
# di .env.local: DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres  dan  DB_POOL_MAX=1
npm run db:migrate
npm run dev                    # http://localhost:3000
```

Atau arahkan `DATABASE_URL` ke database Neon/Postgres mana pun.

## Struktur

- `app/api/*` — REST API (auth, victims, reports, tests, settings, import)
- `components/` — UI React (port dari HTML asli; `useStore.ts` = state, sinkron, antrean offline)
- `lib/` — skema validasi (zod), akses DB (`pg`), auth, logika triase bersama klien & server
- `db/schema.sql` — skema database
