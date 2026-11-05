-- Skema TriaSiap. Idempoten: aman dijalankan berulang kali.
CREATE TABLE IF NOT EXISTS victims (
  id          TEXT PRIMARY KEY,
  lok         TEXT NOT NULL,
  anak        BOOLEAN NOT NULL DEFAULT FALSE,
  kat         TEXT NOT NULL CHECK (kat IN ('merah','kuning','hijau','hitam')),
  ts          BIGINT NOT NULL,
  why         TEXT NOT NULL DEFAULT '',
  op          TEXT NOT NULL DEFAULT '',
  note        TEXT NOT NULL DEFAULT '',
  sent        BOOLEAN NOT NULL DEFAULT FALSE,
  assessment  JSONB NOT NULL DEFAULT '{}'::jsonb,
  evac        JSONB NOT NULL DEFAULT '{"status":"Belum dievakuasi","destination":"","officer":"","time":null,"note":""}'::jsonb,
  hist        JSONB NOT NULL DEFAULT '[]'::jsonb,
  evac_hist   JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS victims_kat_idx ON victims (kat);

CREATE TABLE IF NOT EXISTS reports (
  id    BIGSERIAL PRIMARY KEY,
  t     BIGINT NOT NULL,
  n     INTEGER NOT NULL,
  c     JSONB NOT NULL,
  m     JSONB NOT NULL DEFAULT '[]'::jsonb,
  od    INTEGER NOT NULL DEFAULT 0,
  op    TEXT NOT NULL DEFAULT '',
  rl    TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS reports_t_op_idx ON reports (t, op);

CREATE TABLE IF NOT EXISTS usability_tests (
  id    TEXT PRIMARY KEY,
  role  TEXT NOT NULL,
  r     JSONB NOT NULL,
  sk    INTEGER NOT NULL,
  kd    TEXT NOT NULL DEFAULT '',
  pb    TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS otp_codes (
  email      TEXT NOT NULL,
  purpose    TEXT NOT NULL,
  code_hash  TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (email, purpose)
);

CREATE TABLE IF NOT EXISTS auth_attempts (
  key          TEXT PRIMARY KEY,
  count        INTEGER NOT NULL DEFAULT 0,
  locked_until BIGINT NOT NULL DEFAULT 0
);
