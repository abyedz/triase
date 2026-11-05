import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { query } from "./db";
import { getSetting } from "./repo";
import { Role, Session } from "./triage";

const COOKIE = "triasiap_session";
const MAX_AGE = 60 * 60 * 12; // 12 jam

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET belum diset (minimal 16 karakter).");
  return new TextEncoder().encode(s);
}

export async function createSession(s: Session) {
  const token = await new SignJWT({ name: s.name, role: s.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE,
  });
}
export async function destroySession() {
  (await cookies()).set(COOKIE, "", { path: "/", maxAge: 0 });
}
export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const role = payload.role as Role;
    if (typeof payload.name !== "string" || !["Perawat", "Relawan", "Koordinator"].includes(role)) return null;
    return { name: payload.name, role };
  } catch {
    return null;
  }
}

// ---- Kata sandi koordinator ----
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const safeEq = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
export function hashPassword(pw: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(pw, salt, 64).toString("hex")}`;
}
export async function verifyCoordinatorPassword(pw: string): Promise<boolean> {
  const stored = await getSetting("coordinator_password_hash"); // hasil pemulihan sandi
  if (stored) {
    const [, salt, hash] = stored.split("$");
    return safeEq(scryptSync(pw, salt, 64).toString("hex"), hash);
  }
  const env = process.env.COORDINATOR_PASSWORD_HASH?.trim().toLowerCase();
  return !!env && safeEq(sha256(pw), env);
}

// ---- Pembatasan percobaan (per IP) ----
const MAX_TRIES = 3;
const LOCK_MS = 15 * 60 * 1000;
export async function attemptState(key: string) {
  const r = await query<{ count: number; locked_until: string }>("SELECT count, locked_until FROM auth_attempts WHERE key=$1", [key]);
  const locked = Number(r[0]?.locked_until ?? 0) > Date.now();
  return { locked, remaining: locked ? 0 : MAX_TRIES - (r[0]?.count ?? 0) };
}
export async function recordFailure(key: string) {
  const r = await query<{ count: number }>(
    `INSERT INTO auth_attempts (key,count) VALUES ($1,1)
     ON CONFLICT (key) DO UPDATE SET count = CASE WHEN auth_attempts.locked_until BETWEEN 1 AND $2 THEN 1 ELSE auth_attempts.count + 1 END
     RETURNING count`,
    [key, Date.now()],
  );
  if (r[0].count >= MAX_TRIES) await query("UPDATE auth_attempts SET locked_until=$2 WHERE key=$1", [key, Date.now() + LOCK_MS]);
  return Math.max(0, MAX_TRIES - r[0].count);
}
export const clearAttempts = (key: string) => query("DELETE FROM auth_attempts WHERE key=$1", [key]);

// ---- Kode OTP email ----
const coordinatorEmails = () => (process.env.COORDINATOR_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
export const isCoordinatorEmail = (email: string) => coordinatorEmails().includes(email.toLowerCase());
const otpHash = (email: string, purpose: string, code: string) => sha256(`${email}|${purpose}|${code}|${process.env.AUTH_SECRET}`);

export async function issueOtp(email: string, purpose: "login" | "reset") {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await query(
    `INSERT INTO otp_codes (email,purpose,code_hash,expires_at,attempts) VALUES ($1,$2,$3,$4,0)
     ON CONFLICT (email,purpose) DO UPDATE SET code_hash=EXCLUDED.code_hash, expires_at=EXCLUDED.expires_at, attempts=0`,
    [email, purpose, otpHash(email, purpose, code), Date.now() + 10 * 60 * 1000],
  );
  return code;
}
export async function consumeOtp(email: string, purpose: "login" | "reset", code: string): Promise<boolean> {
  const r = await query<{ code_hash: string; expires_at: string; attempts: number }>(
    "SELECT code_hash, expires_at, attempts FROM otp_codes WHERE email=$1 AND purpose=$2", [email, purpose]);
  const row = r[0];
  if (!row || Number(row.expires_at) < Date.now() || row.attempts >= 5) return false;
  if (!safeEq(row.code_hash, otpHash(email, purpose, code))) {
    await query("UPDATE otp_codes SET attempts=attempts+1 WHERE email=$1 AND purpose=$2", [email, purpose]);
    return false;
  }
  await query("DELETE FROM otp_codes WHERE email=$1 AND purpose=$2", [email, purpose]);
  return true;
}

export async function sendEmail(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Pengiriman email belum dikonfigurasi (RESEND_API_KEY).");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || "TriaSiap <onboarding@resend.dev>", to, subject, text }),
  });
  if (!res.ok) throw new Error("Gagal mengirim email.");
}

export function clientIp(req: Request) {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
}
