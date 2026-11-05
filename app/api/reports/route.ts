import { body, guarded, json } from "@/lib/http";
import { getRetri, insertReport, listReports, listVictims, markAllSent } from "@/lib/repo";
import { clampTs, reportSchema } from "@/lib/schemas";
import { buildReport } from "@/lib/triage";

export const GET = guarded({}, async () => json({ reports: await listReports() }));

// Kirim laporan ke pos komando: ringkasan dihitung dari data server.
export const POST = guarded({}, async (req, _c, s) => {
  const b = await body(req, reportSchema);
  const victims = await listVictims();
  if (!victims.length) return json({ message: "Belum ada data korban" }, 409);
  const report = buildReport(victims, await getRetri(), s.name, s.role, clampTs(b.t));
  await insertReport(report);
  await markAllSent();
  return json({ report }, 201);
});
