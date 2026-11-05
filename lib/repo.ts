import { query } from "./db";
import { Assessment, Evac, EvacHist, HistEntry, Kat, Report, UsabilityTest, Victim } from "./triage";

type VRow = {
  id: string; lok: string; anak: boolean; kat: Kat; ts: string | number; why: string; op: string; note: string; sent: boolean;
  assessment: Assessment; evac: Evac; hist: HistEntry[]; evac_hist: EvacHist[];
};
const toVictim = (r: VRow): Victim => ({
  id: r.id, lok: r.lok, anak: r.anak, kat: r.kat, ts: Number(r.ts), why: r.why, op: r.op, note: r.note, sent: r.sent,
  assessment: r.assessment, evac: r.evac, hist: r.hist, evacHist: r.evac_hist,
});

export async function listVictims(): Promise<Victim[]> {
  return (await query<VRow>("SELECT * FROM victims ORDER BY id")).map(toVictim);
}
export async function getVictim(id: string): Promise<Victim | null> {
  const r = await query<VRow>("SELECT * FROM victims WHERE id=$1", [id]);
  return r[0] ? toVictim(r[0]) : null;
}

/** Buat korban baru dengan ID berurutan (K-001, ...). Retry bila bentrok antar perangkat. */
export async function createVictim(v: { lok: string; anak: boolean; kat: Kat; ts: number; why: string; op: string; assessment: Assessment }): Promise<Victim> {
  const note = v.assessment.note || "";
  for (let i = 0; i < 6; i++) {
    try {
      const r = await query<{ id: string }>(
        `INSERT INTO victims (id, lok, anak, kat, ts, why, op, note, assessment)
         SELECT 'K-' || lpad((coalesce(max(nullif(regexp_replace(id,'\\D','','g'),'')::int),0)+1)::text, 3, '0'),
                $1::text, $2::boolean, $3::text, $4::bigint, $5::text, $6::text, $7::text, $8::jsonb
         FROM victims RETURNING id`,
        [v.lok, v.anak, v.kat, v.ts, v.why, v.op, note, JSON.stringify(v.assessment)],
      );
      return (await getVictim(r[0].id))!;
    } catch (e) {
      if ((e as { code?: string }).code !== "23505") throw e; // hanya ulangi pada unique violation
    }
  }
  throw new Error("Gagal membuat ID korban, coba lagi.");
}

export async function saveVictim(v: Victim): Promise<void> {
  await query(
    `UPDATE victims SET lok=$2, anak=$3, kat=$4, ts=$5, why=$6, op=$7, note=$8, sent=$9,
       assessment=$10::jsonb, evac=$11::jsonb, hist=$12::jsonb, evac_hist=$13::jsonb, updated_at=now() WHERE id=$1`,
    [v.id, v.lok, v.anak, v.kat, v.ts, v.why, v.op, v.note, v.sent, JSON.stringify(v.assessment), JSON.stringify(v.evac), JSON.stringify(v.hist), JSON.stringify(v.evacHist)],
  );
}
export async function upsertVictim(v: Victim): Promise<void> {
  await query(
    `INSERT INTO victims (id, lok, anak, kat, ts, why, op, note, sent, assessment, evac, hist, evac_hist)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb)
     ON CONFLICT (id) DO UPDATE SET lok=EXCLUDED.lok, anak=EXCLUDED.anak, kat=EXCLUDED.kat, ts=EXCLUDED.ts, why=EXCLUDED.why,
       op=EXCLUDED.op, note=EXCLUDED.note, sent=EXCLUDED.sent, assessment=EXCLUDED.assessment, evac=EXCLUDED.evac,
       hist=EXCLUDED.hist, evac_hist=EXCLUDED.evac_hist, updated_at=now()
     WHERE victims.ts <= EXCLUDED.ts`,
    [v.id, v.lok, v.anak, v.kat, v.ts, v.why, v.op, v.note, v.sent, JSON.stringify(v.assessment), JSON.stringify(v.evac), JSON.stringify(v.hist), JSON.stringify(v.evacHist)],
  );
}
export const markAllSent = () => query("UPDATE victims SET sent=TRUE WHERE sent=FALSE");
export const deleteAllData = async () => { await query("DELETE FROM victims"); await query("DELETE FROM reports"); };

export async function listReports(): Promise<Report[]> {
  const r = await query<Report & { t: string | number }>("SELECT t,n,c,m,od,op,rl FROM reports ORDER BY t DESC LIMIT 200");
  return r.map((x) => ({ ...x, t: Number(x.t) }));
}
export async function insertReport(r: Omit<Report, "id">): Promise<void> {
  await query(
    "INSERT INTO reports (t,n,c,m,od,op,rl) VALUES ($1,$2,$3::jsonb,$4::jsonb,$5,$6,$7) ON CONFLICT (t,op) DO NOTHING",
    [r.t, r.n, JSON.stringify(r.c), JSON.stringify(r.m), r.od, r.op, r.rl],
  );
}

export const listTests = () => query<UsabilityTest>("SELECT id,role,r,sk,kd,pb FROM usability_tests ORDER BY id");
export async function addTest(t: Omit<UsabilityTest, "id">): Promise<void> {
  const rows = await query<{ m: number | null }>("SELECT max(substring(id from 2)::int) AS m FROM usability_tests");
  const id = "P" + String((rows[0]?.m ?? 0) + 1).padStart(2, "0");
  await query("INSERT INTO usability_tests (id,role,r,sk,kd,pb) VALUES ($1,$2,$3::jsonb,$4,$5,$6)", [id, t.role, JSON.stringify(t.r), t.sk, t.kd, t.pb]);
}
export const deleteTest = (id: string) => query("DELETE FROM usability_tests WHERE id=$1", [id]);

export async function getSetting(key: string): Promise<string | null> {
  const r = await query<{ value: string }>("SELECT value FROM settings WHERE key=$1", [key]);
  return r[0]?.value ?? null;
}
export const setSetting = (key: string, value: string) =>
  query("INSERT INTO settings (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value", [key, value]);
export async function getRetri(): Promise<number> {
  const v = Number(await getSetting("retri"));
  return [5, 10, 15, 30].includes(v) ? v : 10;
}
