import { body, guarded, json } from "@/lib/http";
import { createVictim, deleteAllData, listVictims } from "@/lib/repo";
import { clampTs, createVictimSchema } from "@/lib/schemas";

export const GET = guarded({}, async () => json({ victims: await listVictims() }));

export const POST = guarded({}, async (req, _c, s) => {
  const b = await body(req, createVictimSchema);
  const v = await createVictim({ lok: b.lok, anak: b.anak, kat: b.kat, why: b.why, assessment: b.assessment, ts: clampTs(b.ts), op: s.name });
  return json({ victim: v }, 201);
});

// Hapus semua data korban & laporan (koordinator).
export const DELETE = guarded({ coordinator: true }, async () => {
  await deleteAllData();
  return json({ ok: true });
});
