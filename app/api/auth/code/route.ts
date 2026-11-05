import { clearAttempts, clientIp, consumeOtp, createSession, hashPassword, isCoordinatorEmail, issueOtp, sendEmail, attemptState, recordFailure } from "@/lib/auth";
import { body, fail, json } from "@/lib/http";
import { setSetting } from "@/lib/repo";
import { codeSchema } from "@/lib/schemas";
import { ZodError } from "zod";

const GENERIC = "Jika email terdaftar sebagai koordinator, kode verifikasi telah dikirim. Periksa kotak masuk dan spam.";

export async function POST(req: Request) {
  try {
    const b = await body(req, codeSchema);
    const ipKey = "otp:" + clientIp(req);

    if (b.action === "send-login" || b.action === "send-reset") {
      const purpose = b.action === "send-login" ? "login" : "reset";
      const st = await attemptState(ipKey + ":send");
      if (st.locked) return fail("Terlalu banyak permintaan. Coba lagi nanti.", 429);
      await recordFailure(ipKey + ":send"); // batasi permintaan kirim kode per IP
      if (isCoordinatorEmail(b.email)) {
        try {
          const code = await issueOtp(b.email, purpose);
          await sendEmail(b.email, "Kode verifikasi TriaSiap", `Kode verifikasi TriaSiap Anda: ${code}\nBerlaku 10 menit. Abaikan email ini bila Anda tidak memintanya.`);
        } catch (e) {
          console.error("[auth] gagal mengirim kode:", e); // tetap balas generik agar email tidak bisa ditebak
        }
      }
      return json({ message: GENERIC }); // respons sama agar email tidak bisa ditebak
    }

    const st = await attemptState(ipKey);
    if (st.locked) return fail("Terlalu banyak percobaan. Coba lagi dalam 15 menit.", 429);
    const purpose = b.action === "verify-login" ? "login" : "reset";
    const ok = isCoordinatorEmail(b.email) && (await consumeOtp(b.email, purpose, b.code));
    if (!ok) {
      await recordFailure(ipKey);
      return json({ message: "Kode tidak valid atau kedaluwarsa" }, 401);
    }
    await clearAttempts(ipKey);
    if (b.action === "verify-login") {
      await createSession({ name: b.name, role: "Koordinator" });
      return json({ ok: true });
    }
    await setSetting("coordinator_password_hash", hashPassword(b.newPassword));
    await clearAttempts("pw:" + clientIp(req));
    return json({ ok: true, message: "Kata sandi berhasil diperbarui." });
  } catch (e) {
    if (e instanceof ZodError) return fail("Isi email, kode 6 digit, dan sandi minimal 8 karakter", 422);
    console.error(e);
    return fail("Terjadi kesalahan server.", 500);
  }
}
