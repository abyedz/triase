import { z } from "zod";
import { EVAC_STATUS } from "./triage";

const short = (n: number) => z.string().trim().max(n).default("");
export const katSchema = z.enum(["merah", "kuning", "hijau", "hitam"]);
export const nameSchema = z.string().trim().min(1).max(40);

export const assessmentSchema = z.object({
  age: short(3), sex: short(20), conscious: short(40), rr: short(3), pulse: short(3), bp: short(15),
  spo2: short(3), temp: short(5), bleeding: short(40), pain: short(2),
  injury: short(300), intervention: short(300), note: short(200),
});

const tsSchema = z.number().int().positive().optional();
/** Waktu dari klien dibatasi: tidak boleh di masa depan. */
export const clampTs = (ts: number | undefined) => Math.min(ts ?? Date.now(), Date.now());

export const createVictimSchema = z.object({
  lok: z.string().trim().min(1).max(60), anak: z.boolean().default(false),
  kat: katSchema, why: z.string().max(300), assessment: assessmentSchema, ts: tsSchema,
});
export const retriSchema = z.object({ kat: katSchema, why: z.string().max(300), assessment: assessmentSchema, ts: tsSchema });
export const evacSchema = z.object({
  status: z.enum(EVAC_STATUS), officer: short(60), destination: short(120), note: short(250), ts: tsSchema,
});
export const reportSchema = z.object({ t: tsSchema });
export const testSchema = z.object({
  role: z.string().trim().max(40), r: z.array(z.enum(["Berhasil", "Dibantu", "Gagal"])).length(4),
  sk: z.number().int().min(1).max(5), kd: short(300), pb: short(300),
});
export const settingsSchema = z.object({ retri: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(30)]) });

export const loginSchema = z.object({ name: nameSchema, role: z.enum(["Perawat", "Relawan", "Koordinator"]), password: z.string().max(64).optional() });
export const codeSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("send-login"), email: z.string().trim().toLowerCase().email().max(120) }),
  z.object({ action: z.literal("verify-login"), email: z.string().trim().toLowerCase().email().max(120), code: z.string().regex(/^\d{6}$/), name: nameSchema }),
  z.object({ action: z.literal("send-reset"), email: z.string().trim().toLowerCase().email().max(120) }),
  z.object({ action: z.literal("reset"), email: z.string().trim().toLowerCase().email().max(120), code: z.string().regex(/^\d{6}$/), newPassword: z.string().min(8).max(64) }),
]);
export const importSchema = z.object({
  app: z.literal("TriaSiap"),
  data: z.object({ victims: z.array(z.any()).max(5000), reports: z.array(z.any()).max(1000).optional() }),
});
