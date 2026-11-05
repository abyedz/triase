// Konstanta & tipe bersama (dipakai server dan klien).
export type Kat = "merah" | "kuning" | "hijau" | "hitam";
export type Role = "Perawat" | "Relawan" | "Koordinator";

export const KATS: Kat[] = ["merah", "kuning", "hijau", "hitam"];
export const KAT: Record<Kat, { n: string; d: string; o: number }> = {
  merah: { n: "MERAH", d: "Segera", o: 0 },
  kuning: { n: "KUNING", d: "Tertunda", o: 1 },
  hijau: { n: "HIJAU", d: "Minor", o: 2 },
  hitam: { n: "HITAM", d: "Ekspektan", o: 3 },
};

export type Outcome = { r: Kat; w: string };
export type Step = { q: string; y: [string, string | Outcome]; n: [string, string | Outcome] };

export const ST: Record<string, Step> = {
  walk: { q: "Minta semua korban yang bisa berjalan pindah ke titik aman. Apakah korban bisa berjalan?", y: ["Ya, bisa berjalan", { r: "hijau", w: "Dapat berjalan sendiri. Dinilai paling akhir." }], n: ["Tidak bisa berjalan", "nap"] },
  nap: { q: "Periksa pernapasan. Apakah korban bernapas?", y: ["Ya, bernapas", "laju"], n: ["Tidak bernapas", "jln"] },
  jln: { q: "Buka jalan napas (reposisi kepala). Apakah korban mulai bernapas?", y: ["Mulai bernapas", { r: "merah", w: "Napas kembali setelah jalan napas dibuka." }], n: ["Tetap tidak bernapas", { r: "hitam", w: "Tidak bernapas meski jalan napas sudah dibuka." }] },
  laju: { q: "Hitung laju napas selama 1 menit.", y: ["30 kali/menit atau kurang", "perf"], n: ["Lebih dari 30 kali/menit", { r: "merah", w: "Napas cepat (lebih dari 30 kali/menit)." }] },
  perf: { q: "Periksa perfusi. Apakah nadi radialis teraba dan pengisian kapiler 2 detik atau kurang?", y: ["Normal", "men"], n: ["Abnormal", { r: "merah", w: "Perfusi abnormal. Hentikan perdarahan hebat dengan penekanan langsung sebelum ke korban berikutnya." }] },
  men: { q: "Periksa status mental. Apakah korban dapat mengikuti perintah sederhana?", y: ["Mampu", { r: "kuning", w: "Napas dan perfusi normal, mampu mengikuti perintah." }], n: ["Tidak mampu", { r: "merah", w: "Tidak mampu mengikuti perintah sederhana." }] },
};
export const STN: Record<string, number> = { walk: 1, nap: 2, jln: 2, laju: 2, perf: 3, men: 4 };

export const EVAC_STATUS = ["Belum dievakuasi", "Dalam proses evakuasi", "Sudah dievakuasi"] as const;

export interface Assessment {
  age?: string; sex?: string; conscious?: string; rr?: string; pulse?: string; bp?: string;
  spo2?: string; temp?: string; bleeding?: string; pain?: string;
  injury?: string; intervention?: string; note?: string;
}
export interface Evac {
  status: string; destination: string; officer: string; time: number | null; note: string;
  updatedAt?: number; updatedBy?: string;
}
export interface HistEntry { k: Kat; t: number; why: string; op: string; assessment: Assessment }
export interface EvacHist { status: string; officer: string; destination: string; note: string; time: number }

export interface Victim {
  id: string; lok: string; anak: boolean; kat: Kat; ts: number; why: string; op: string;
  note: string; sent: boolean; assessment: Assessment; evac: Evac; hist: HistEntry[]; evacHist: EvacHist[];
  pending?: boolean; // hanya klien: belum tersinkron (dibuat saat offline)
}
export interface Report {
  id?: number; t: number; n: number; c: Record<Kat, number>;
  m: { id: string; lok: string; ts: number }[]; od: number; op: string; rl: string;
  queued?: boolean; // hanya klien: antre saat offline
}
export interface UsabilityTest { id: string; role: string; r: string[]; sk: number; kd: string; pb: string }
export interface Session { name: string; role: Role }

export const ASSESS_KEYS = ["age", "sex", "conscious", "rr", "pulse", "bp", "spo2", "temp", "bleeding", "pain", "injury", "intervention", "note"] as const;

export const defaultEvac = (): Evac => ({ status: "Belum dievakuasi", destination: "", officer: "", time: null, note: "" });

export const isOverdue = (v: Pick<Victim, "kat" | "ts">, retriMin: number, now = Date.now()) =>
  (v.kat === "merah" || v.kat === "kuning") && now - v.ts > retriMin * 60000;

/** Terapkan retriase pada korban (dipakai server dan optimistic update di klien). */
export function applyRetri(v: Victim, b: { kat: Kat; why: string; assessment: Assessment; ts: number }, op: string): Victim {
  const merged: Assessment = {};
  for (const k of ASSESS_KEYS) merged[k] = b.assessment[k] || v.assessment?.[k] || "";
  return {
    ...v,
    hist: [...(v.hist || []), { k: v.kat, t: v.ts, why: v.why, op: v.op, assessment: v.assessment || {} }],
    kat: b.kat, ts: b.ts, why: b.why, op, assessment: merged, note: merged.note || "", sent: false,
  };
}

/** Terapkan pembaruan evakuasi. Mengembalikan null bila tidak ada perubahan. */
export function applyEvac(
  v: Victim,
  b: { status: string; officer: string; destination: string; note: string; ts: number },
  op: string,
): Victim | null {
  const old = v.evac || defaultEvac();
  if (b.status === old.status && b.officer === old.officer && b.destination === old.destination && b.note === old.note) return null;
  return {
    ...v,
    evacHist: [...(v.evacHist || []), { status: old.status || "Belum dievakuasi", officer: old.officer || "", destination: old.destination || "", note: old.note || "", time: b.ts }],
    evac: {
      status: b.status, officer: b.officer, destination: b.destination, note: b.note,
      time: b.status === "Sudah dievakuasi" ? old.time || b.ts : null, updatedAt: b.ts, updatedBy: op,
    },
  };
}

export const buildReport = (victims: Victim[], retriMin: number, op: string, role: string, ts: number): Omit<Report, "id"> => {
  const cnt = (k: Kat) => victims.filter((v) => v.kat === k).length;
  return {
    t: ts, n: victims.length,
    c: { merah: cnt("merah"), kuning: cnt("kuning"), hijau: cnt("hijau"), hitam: cnt("hitam") },
    m: victims.filter((v) => v.kat === "merah").map((v) => ({ id: v.id, lok: v.lok, ts: v.ts })),
    od: victims.filter((v) => isOverdue(v, retriMin, ts)).length, op, rl: role,
  };
};
