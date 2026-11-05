import { attemptState, clearAttempts, clientIp, createSession, recordFailure, verifyCoordinatorPassword } from "@/lib/auth";
import { body, fail, json } from "@/lib/http";
import { loginSchema } from "@/lib/schemas";
import { ZodError } from "zod";

export async function POST(req: Request) {
  try {
    const b = await body(req, loginSchema);
    if (b.role !== "Koordinator") {
      await createSession({ name: b.name, role: b.role });
      return json({ ok: true });
    }
    const key = "pw:" + clientIp(req);
    const st = await attemptState(key);
    if (st.locked) return json({ message: "Login sandi dikunci. Gunakan pemulihan melalui email.", locked: true, remaining: 0 }, 429);
    if (!b.password) return fail("Masukkan kata sandi koordinator");
    if (!(await verifyCoordinatorPassword(b.password))) {
      const remaining = await recordFailure(key);
      return json({ message: remaining ? `Kata sandi salah. Sisa ${remaining} percobaan.` : "3 kali percobaan gagal. Gunakan pemulihan email.", locked: remaining === 0, remaining }, 401);
    }
    await clearAttempts(key);
    await createSession({ name: b.name, role: "Koordinator" });
    return json({ ok: true });
  } catch (e) {
    if (e instanceof ZodError) return fail("Data tidak valid.", 422);
    console.error(e);
    return fail("Terjadi kesalahan server.", 500);
  }
}
