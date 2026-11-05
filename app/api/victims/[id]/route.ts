import { body, fail, guarded, json } from "@/lib/http";
import { getVictim, saveVictim } from "@/lib/repo";
import { clampTs, evacSchema, retriSchema } from "@/lib/schemas";
import { applyEvac, applyRetri } from "@/lib/triage";

type Ctx = { params: Promise<{ id: string }> };

// Retriase ulang (semua petugas).
export const PUT = guarded<Ctx>({}, async (req, ctx, s) => {
  const { id } = await ctx.params;
  const b = await body(req, retriSchema);
  const v = await getVictim(id);
  if (!v) return fail("Data pasien tidak ditemukan", 404);
  const next = applyRetri(v, { kat: b.kat, why: b.why, assessment: b.assessment, ts: clampTs(b.ts) }, s.name);
  await saveVictim(next);
  return json({ victim: next });
});

// Pembaruan status evakuasi (koordinator).
export const PATCH = guarded<Ctx>({ coordinator: true }, async (req, ctx, s) => {
  const { id } = await ctx.params;
  const b = await body(req, evacSchema);
  if (b.status === "Sudah dievakuasi" && !b.destination) return fail("Isi tujuan evakuasi terlebih dahulu", 422);
  const v = await getVictim(id);
  if (!v) return fail("Data pasien tidak ditemukan", 404);
  const next = applyEvac(v, { status: b.status, officer: b.officer, destination: b.destination, note: b.note, ts: clampTs(b.ts) }, s.name);
  if (!next) return json({ victim: v, unchanged: true });
  await saveVictim(next);
  return json({ victim: next });
});
