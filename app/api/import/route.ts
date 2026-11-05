import { body, guarded, json } from "@/lib/http";
import { insertReport, upsertVictim } from "@/lib/repo";
import { importSchema } from "@/lib/schemas";
import { assessmentSchema, katSchema } from "@/lib/schemas";
import { Victim, defaultEvac } from "@/lib/triage";

// Gabungkan file JSON ekspor dari perangkat petugas lain (koordinator).
export const POST = guarded({ coordinator: true }, async (req) => {
  const b = await body(req, importSchema);
  let count = 0;
  for (const raw of b.data.victims) {
    if (!raw || typeof raw.id !== "string" || !/^[\w-]{1,20}$/.test(raw.id)) continue;
    const kat = katSchema.safeParse(raw.kat);
    if (!kat.success) continue;
    const v: Victim = {
      id: raw.id, lok: String(raw.lok ?? "").slice(0, 60), anak: !!raw.anak, kat: kat.data, ts: Number(raw.ts) || Date.now(),
      why: String(raw.why ?? "").slice(0, 300), op: String(raw.op ?? "").slice(0, 40), note: String(raw.note ?? "").slice(0, 200), sent: !!raw.sent,
      assessment: assessmentSchema.safeParse(raw.assessment ?? {}).data ?? assessmentSchema.parse({}),
      evac: { ...defaultEvac(), ...(raw.evac ?? {}) },
      hist: Array.isArray(raw.hist) ? raw.hist : [], evacHist: Array.isArray(raw.evacHist) ? raw.evacHist : [],
    };
    await upsertVictim(v);
    count++;
  }
  for (const r of b.data.reports ?? []) {
    if (r && typeof r.t === "number" && r.c && typeof r.n === "number")
      await insertReport({ t: r.t, n: r.n, c: r.c, m: Array.isArray(r.m) ? r.m : [], od: Number(r.od) || 0, op: String(r.op ?? ""), rl: String(r.rl ?? "") });
  }
  return json({ imported: count });
});
