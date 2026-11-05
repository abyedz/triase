-- Query siap pakai TriaSiap. Jalankan satu per satu di SQL Editor Neon/Vercel (skema: db/schema.sql).
-- Catatan: kolom ts / t / time disimpan sebagai epoch MILIDETIK.

-- ============================================================
-- A. DATA CONTOH (opsional, untuk demo)
-- ============================================================
INSERT INTO victims (id, lok, kat, ts, why, op) VALUES
  ('K-001', 'Zona A, reruntuhan',    'merah',  (extract(epoch from now())*1000)::bigint - 25*60000, 'Data contoh', 'Demo'),
  ('K-002', 'Zona A, reruntuhan',    'kuning', (extract(epoch from now())*1000)::bigint -  8*60000, 'Data contoh', 'Demo'),
  ('K-003', 'Zona B, tenda',         'hijau',  (extract(epoch from now())*1000)::bigint - 30*60000, 'Data contoh', 'Demo'),
  ('K-004', 'Zona B, tenda',         'hijau',  (extract(epoch from now())*1000)::bigint - 22*60000, 'Data contoh', 'Demo'),
  ('K-005', 'Zona C, jalan utama',   'merah',  (extract(epoch from now())*1000)::bigint -  4*60000, 'Data contoh', 'Demo'),
  ('K-006', 'Zona C, jalan utama',   'hitam',  (extract(epoch from now())*1000)::bigint - 15*60000, 'Data contoh', 'Demo'),
  ('K-007', 'Zona A, pintu masuk',   'kuning', (extract(epoch from now())*1000)::bigint - 14*60000, 'Data contoh', 'Demo')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- B. DASBOR & REKAP
-- ============================================================

-- B1. Jumlah korban per kategori (urut prioritas)
SELECT kat, count(*) AS jumlah
FROM victims
GROUP BY kat
ORDER BY array_position(ARRAY['merah','kuning','hijau','hitam'], kat);

-- B2. Ringkasan dasbor: total, belum dilaporkan, perlu retriase (ganti 10 = menit pengingat)
SELECT count(*)                                         AS total,
       count(*) FILTER (WHERE NOT sent)                 AS belum_dilaporkan,
       count(*) FILTER (WHERE kat IN ('merah','kuning')
         AND (extract(epoch from now())*1000)::bigint - ts > 10*60000) AS perlu_retriase
FROM victims;

-- B3. Daftar korban (urut prioritas lalu yang paling lama menunggu)
SELECT id, kat, lok, to_timestamp(ts/1000.0) AS dinilai, jsonb_array_length(hist)+1 AS kali_dinilai, note
FROM victims
ORDER BY array_position(ARRAY['merah','kuning','hijau','hitam'], kat), ts;

-- B4. Daftar korban yang perlu retriase sekarang
SELECT id, kat, lok,
       floor(((extract(epoch from now())*1000)::bigint - ts)/60000) AS menit_sejak_dinilai
FROM victims
WHERE kat IN ('merah','kuning')
  AND (extract(epoch from now())*1000)::bigint - ts > (SELECT coalesce(value::int,10) FROM settings WHERE key='retri' UNION ALL SELECT 10 LIMIT 1) * 60000
ORDER BY ts;

-- ============================================================
-- C. EVAKUASI (dashboard komandan)
-- ============================================================

-- C1. Jumlah per status evakuasi
SELECT evac->>'status' AS status_evakuasi, count(*) AS jumlah
FROM victims
GROUP BY 1
ORDER BY 1;

-- C2. Evakuasi per kategori x status
SELECT kat,
       count(*) FILTER (WHERE evac->>'status'='Belum dievakuasi')      AS belum,
       count(*) FILTER (WHERE evac->>'status'='Dalam proses evakuasi') AS proses,
       count(*) FILTER (WHERE evac->>'status'='Sudah dievakuasi')      AS sudah
FROM victims GROUP BY kat;

-- C3. Rekap pasien lengkap (setara ekspor CSV)
SELECT id AS "ID Pasien", lok AS "Lokasi", upper(kat) AS "Kategori Triase", why AS "Alasan Triase",
       to_timestamp(ts/1000.0) AS "Waktu Triase", op AS "Petugas Triase",
       assessment->>'age' AS "Usia", assessment->>'sex' AS "Jenis Kelamin", assessment->>'conscious' AS "Kesadaran",
       assessment->>'rr' AS "Frekuensi Napas", assessment->>'pulse' AS "Nadi", assessment->>'bp' AS "Tekanan Darah",
       assessment->>'spo2' AS "SpO2", assessment->>'temp' AS "Suhu", assessment->>'bleeding' AS "Perdarahan",
       assessment->>'pain' AS "Skala Nyeri", assessment->>'injury' AS "Cedera/Kondisi Fisik",
       assessment->>'intervention' AS "Tindakan Awal", assessment->>'note' AS "Catatan",
       evac->>'status' AS "Status Evakuasi", evac->>'destination' AS "Tujuan Evakuasi",
       evac->>'officer' AS "Petugas Evakuasi",
       CASE WHEN evac->>'time' IS NOT NULL THEN to_timestamp((evac->>'time')::bigint/1000.0) END AS "Waktu Evakuasi",
       evac->>'note' AS "Catatan Evakuasi"
FROM victims
ORDER BY id;

-- C3b. Perbarui status evakuasi manual (contoh)
-- UPDATE victims SET evac = evac || jsonb_build_object('status','Sudah dievakuasi','destination','RS Umum',
--        'time',(extract(epoch from now())*1000)::bigint), updated_at = now() WHERE id = 'K-001';

-- ============================================================
-- D. RIWAYAT
-- ============================================================

-- D1. Riwayat retriase per korban (entri lama + penilaian saat ini)
SELECT v.id, h.ord, to_timestamp((h.e->>'t')::bigint/1000.0) AS waktu, h.e->>'k' AS kategori, h.e->>'op' AS petugas, h.e->>'why' AS alasan
FROM victims v, jsonb_array_elements(v.hist) WITH ORDINALITY AS h(e, ord)
ORDER BY v.id, h.ord;

-- D2. Korban yang kategorinya berubah (pernah diretriase)
SELECT id, kat AS kategori_sekarang, jsonb_array_length(hist) AS jumlah_retriase
FROM victims WHERE jsonb_array_length(hist) > 0 ORDER BY jumlah_retriase DESC;

-- D3. Riwayat perubahan evakuasi per korban
SELECT v.id, to_timestamp((h.e->>'time')::bigint/1000.0) AS waktu, h.e->>'status' AS status_sebelumnya, h.e->>'officer' AS petugas
FROM victims v, jsonb_array_elements(v.evac_hist) AS h(e)
ORDER BY v.id, waktu;

-- ============================================================
-- E. LAPORAN & UJI KEGUNAAN
-- ============================================================

-- E1. 20 laporan terakhir ke pos komando
SELECT to_timestamp(t/1000.0) AS waktu, op AS petugas, rl AS peran, n AS total_korban,
       (c->>'merah')::int AS merah, (c->>'kuning')::int AS kuning, (c->>'hijau')::int AS hijau, (c->>'hitam')::int AS hitam, od AS perlu_retriase
FROM reports ORDER BY t DESC LIMIT 20;

-- E2. Kinerja petugas: jumlah korban yang dinilai per petugas
SELECT op AS petugas, count(*) AS korban_dinilai FROM victims GROUP BY op ORDER BY korban_dinilai DESC;

-- E3. Ringkasan uji kegunaan: % berhasil per tugas + skor rata-rata
SELECT count(*) AS peserta,
       round(100.0 * count(*) FILTER (WHERE r->>0 = 'Berhasil') / nullif(count(*),0)) AS tugas1_pct,
       round(100.0 * count(*) FILTER (WHERE r->>1 = 'Berhasil') / nullif(count(*),0)) AS tugas2_pct,
       round(100.0 * count(*) FILTER (WHERE r->>2 = 'Berhasil') / nullif(count(*),0)) AS tugas3_pct,
       round(100.0 * count(*) FILTER (WHERE r->>3 = 'Berhasil') / nullif(count(*),0)) AS tugas4_pct,
       round(avg(sk), 1) AS skor_rata_rata
FROM usability_tests;

-- ============================================================
-- F. PERAWATAN / ADMIN
-- ============================================================

-- F1. Atur ulang sandi koordinator ke nilai COORDINATOR_PASSWORD_HASH (env)
DELETE FROM settings WHERE key = 'coordinator_password_hash';

-- F2. Buka kunci login (hapus pembatasan percobaan) dan bersihkan kode OTP kedaluwarsa
DELETE FROM auth_attempts;
DELETE FROM otp_codes WHERE expires_at < (extract(epoch from now())*1000)::bigint;

-- F3. Ubah interval pengingat retriase (5, 10, 15, atau 30 menit)
INSERT INTO settings (key, value) VALUES ('retri', '10')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- F4. HAPUS SEMUA DATA korban & laporan (tidak bisa dibatalkan, hapus tanda komentar bila yakin)
-- TRUNCATE victims, reports;

-- F5. Ukuran tabel
SELECT relname AS tabel, n_live_tup AS perkiraan_baris, pg_size_pretty(pg_total_relation_size(relid)) AS ukuran
FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC;
